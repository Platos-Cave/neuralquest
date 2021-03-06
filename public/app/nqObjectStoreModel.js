define([
	"dojo/_base/array", // array.filter array.forEach array.indexOf array.some
	"dojo/_base/declare", // declare
	"dojo/Deferred",
	"dojo/_base/lang", // lang.hitch
    "dojo/promise/all",
	"dijit/Destroyable"
], function(array, declare, Deferred, lang, all, Destroyable){

	// module:
	//		dijit/tree/ObjectStoreModel

	return declare("nqObjectStoreModel", Destroyable, {
		// summary:
		//		Implements dijit/tree/model connecting dijit/Tree to a dojo/store/api/Store that implements
		//		getChildren().
		//
		//		If getChildren() returns an array with an observe() method, then it will be leveraged to reflect
		//		store updates to the tree.   So, this class will work best when:
		//
		//			1. the store implements dojo/store/Observable
		//			2. getChildren() is implemented as a query to the server (i.e. it calls store.query())
		//
		//		Drag and Drop: To support drag and drop, besides implementing getChildren()
		//		and dojo/store/Observable, the store must support the parent option to put().
		//		And in order to have child elements ordered according to how the user dropped them,
		//		put() must support the before option.

		// store: dojo/store/api/Store
		//		Underlying store
		store: null,

		// labelAttr: String
		//		Get label for tree node from this attribute
		labelAttr: "name",

		// labelType: [const] String
		//		Specifies how to interpret the labelAttr in the data store items.
		//		Can be "html" or "text".
		labelType: "text",

		// root: [readonly] Object
		//		Pointer to the root item from the dojo/store/api/Store (read only, not a parameter)
		root: null,

		// query: anything
		//		Specifies datastore query to return the root item for the tree.
		//		Must only return a single item.   Alternately can just pass in pointer
		//		to root item.
		// example:
		//	|	{id:'ROOT'}
		query: null,

		constructor: function(/* Object */ args){
			// summary:
			//		Passed the arguments listed above (store, etc)
			// tags:
			//		private

			lang.mixin(this, args);

			// Map from id of each parent node to array of its children, or to Promise for that array of children.
			this.childrenCache = {};
		},

		// =======================================================================
		// Methods for traversing hierarchy

		getRoot: function(onItem, onError){
            var self = this;
            var collection = self.store.getCollectionForSubstitutedQuery(self.schema.rootQuery, this.docId, this.docId);
			collection.on('update', function(event){
                //TODO the tree cookie screws hasChildren so we dont get auto expand
				var obj = event.target;
				self.onChange(obj);
			});
			collection.fetch().then(function(children){
				if(children.length == 0) onItem([]);
                else {
                    var newChild = lang.clone(children[0]);
                    newChild.$queryName = 'rootQuery';
                    newChild.hasChildren = true;
                    onItem(newChild);//we expect only one
                }
            });
		},
		mayHaveChildren: function(item){
			return item.hasChildren;
		},
        getChildren: function(/*Object*/ parentItem, /*function(items)*/ onComplete, /*function*/ onError) {
			var self = this;
			var query;
            // Find the query that we'll be using
			if('$queryName' in parentItem) {
                if (parentItem.$queryName == "widgets") debugger;
				if (parentItem.$queryName == 'rootQuery') query = self.schema.query;
				else {
					var prevQuery = self.getSubQueryByName(self.schema.query, parentItem.$queryName);
					if('recursive' in prevQuery) {
						if(prevQuery.recursive == 'schemaQuery') query = self.schema.query;
						//else if (prevQuery.recursive == 'same') query = prevQuery;
                        else query = self.getSubQueryByName(self.schema.query, prevQuery.recursive);
					}
					else if ('join' in prevQuery) query = prevQuery.join;
				}
			}
			else query = self.schema.query;
			if(!query) {// return empty array
				var childrenArr = [];
				onComplete(childrenArr);
				return;
			}

			var childrenPromises = [];
			if(Array.isArray(query)){
                query.forEach(function (subQuery) {
					childrenPromises.push(self.getChildrenArray(subQuery, parentItem, self.docId, true));
				});
			}
			else childrenPromises.push(self.getChildrenArray(query, parentItem, self.docId, true));

			all(childrenPromises).then(function(childrenArrs){
				var resultingChildren = [];
				childrenArrs.forEach(function(childrenArr){
					resultingChildren = resultingChildren.concat(childrenArr);
				});
				onComplete(resultingChildren);
			}, nq.errorDialog);
        },

		getChildrenArray: function(query, parentItem, docId, checkHasGrandChildren) {
			var self = this;
			if('subDoc' in query) {
				var childObjects = parentItem[query.subDoc];
				if(!childObjects) return [];
				var newChildObjs = [];
				var num = 0;
				childObjects.forEach(function (childObj) {
					var newChildObj = lang.clone(childObj);
                    newChildObj._id = parentItem._id + ':' + query.subDoc+num;
                    newChildObj.$queryName = query.queryName;
					newChildObj.hasChildren = true;
					newChildObj.name = childObj.name?childObj.name:query.subDoc+' '+num;
					//See if there are any grandchildren
					//hasChildrenPromises.push(self.hasGrandChildren(childObj, viewObj));
					newChildObjs.push(newChildObj);
					num ++;
				});
				return newChildObjs;
			}
			else if('where' in query) {
                var childrenCollection = self.store.getCollectionForSubstitutedQuery(query, parentItem, docId);
				return childrenCollection.fetch().then(function (childObjects) {
                    var correctChildObjArr = [];
                    // in the case of in array, we have reorder because the query returns the natural order
                    if('operator' in query.where && query.where.operator == 'in'){
                        var properOrderArr = [];
                        //var qualifier = query.where.in;
                        //var key = query.where.docProp;
                        var value = query.where.value;
                        if(value.substring(0, 1) == '$') {
                            var values = value.split('.');
                            if(values.length>1) {
                                if(values[0] == "$self") properOrderArr = selfObj[values[1]];
                                else if(values[0] == "$parent") {
                                    var attr = values[1];
                                    properOrderArr = parentItem[attr];
                                }
                            }
                            else properOrderArr = parentItem[value.substring(1)];
                        }
                        childObjects.forEach(function(childObj){
                            var position = array.indexOf(properOrderArr, childObj._id);
                            correctChildObjArr[position] = lang.clone(childObj);
                        });
                    }
                    else {
                        childObjects.forEach(function(childObj){
                            correctChildObjArr.push(lang.clone(childObj));
                        });
                    }
					var hasGrandChildrenPromises = [];
                    correctChildObjArr.forEach(function (childObj) {
                        childObj.$queryName = query.queryName;
						//See if there are any grandchildren
						if(checkHasGrandChildren) hasGrandChildrenPromises.push(self.hasGrandChildren(childObj, false));
						else hasGrandChildrenPromises.push(true);
					});
					return all(hasGrandChildrenPromises).then(function(hasGrandChildrenPromisesArr){
						var counter = 0;
                        hasGrandChildrenPromisesArr.forEach(function(hasGrandChildrenPromises){
                            var newChildObj = correctChildObjArr[counter];
							newChildObj.hasChildren = hasGrandChildrenPromises.length>0?true:false;
							counter ++;
						});
						return correctChildObjArr;
					});
				});
			}
			else return [];
		},
        hasGrandChildren: function(parentItem, checkHasGrandChildren) {
            var self = this;
            var query;
            // Find the query that we'll be using
            if('$queryName' in parentItem) {
                var prevQuery = self.getSubQueryByName(self.schema.query, parentItem.$queryName);
                if('recursive' in prevQuery) {
                    if(prevQuery.recursive == 'schemaQuery') query = self.schema.query;
                    //else if (prevQuery.recursive == 'same') query = prevQuery;
                    else query = self.getSubQueryByName(self.schema.query, prevQuery.recursive);
                }
                else if ('join' in prevQuery) query = prevQuery.join;
            }
            if(!query) return[];

            var childrenPromises = [];
            if(Array.isArray(query)){
                query.forEach(function (subQuery) {
                    childrenPromises.push(self.getChildrenArray(subQuery, parentItem, self.docId, checkHasGrandChildren));
                });
            }
            else childrenPromises.push(self.getChildrenArray(query, parentItem, self.docId, checkHasGrandChildren));

            return all(childrenPromises).then(function(childrenArrs){
                var resultingChildren = [];
                childrenArrs.forEach(function(childrenArr){
                    resultingChildren = resultingChildren.concat(childrenArr);
                });
                return resultingChildren;
            });
        },
		getSubQueryByName: function(query, queryName) {
			if(Array.isArray(query)){
				for(var i=0;i<query.length;i++){
                    var subQuery = query[i];
					var foundQuery = this.getSubQueryByName(subQuery, queryName);
                    if(foundQuery) return foundQuery;
				}
			}
			else if(query.queryName == queryName) return query;
            else if('join' in query) return this.getSubQueryByName(query.join, queryName);
		},

		// =======================================================================
		// Inspecting items

		isItem: function(/*===== something =====*/){
			return true;	// Boolean
		},

		getIdentity: function(/* item */ item){
			return this.store.getIdentity(item);	// Object
		},

		getLabel: function(/*dojo/data/Item*/ item){
			// summary:
			//		Get the label for an item
			return item[this.labelAttr];	// String
		},

		// =======================================================================
		// Write interface, for DnD

		newItem: function(/* dijit/tree/dndSource.__Item */ args, /*Item*/ parent, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			//		Creates a new item.   See `dojo/data/api/Write` for details on args.
			//		Used in drag & drop when item from external source dropped onto tree.

			return this.store.put(args, {
				parent: parent,
				before: before
			});
		},

		pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem,
					/*Boolean*/ bCopy, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			//		Move or copy an item from one parent item to another.
			//		Used in drag & drop.


			var d = new Deferred();

			if(oldParentItem === newParentItem && !bCopy && !before){
				// Avoid problem when items visually disappear when dropped onto their parent.
				// Happens because the (no-op) store.put() call doesn't generate any notification
				// that the childItem was added/moved.
				d.resolve(true);
				return d;
			}

			if(oldParentItem && !bCopy){
				// In order for DnD moves to work correctly, childItem needs to be orphaned from oldParentItem
				// before being adopted by newParentItem.   That way, the TreeNode is moved rather than
				// an additional TreeNode being created, and the old TreeNode subsequently being deleted.
				// The latter loses information such as selection and opened/closed children TreeNodes.
				// Unfortunately simply calling this.store.put() will send notifications in a random order, based
				// on when the TreeNodes in question originally appeared, and not based on the drag-from
				// TreeNode vs. the drop-onto TreeNode.

				this.getChildren(oldParentItem, lang.hitch(this, function(oldParentChildren){
					oldParentChildren = [].concat(oldParentChildren); // concat to make copy
					var index = array.indexOf(oldParentChildren, childItem);
					oldParentChildren.splice(index, 1);
					this.onChildrenChange(oldParentItem, oldParentChildren);

					d.resolve(this.store.processDirectives(childItem, {
						overwrite: true,
						parent: newParentItem,
						oldParent: oldParentItem,
						before: before
					}));
				}));
			}else{
				d.resolve(this.store.processDirectives(childItem, {
					overwrite: true,
					parent: newParentItem,
					oldParent: oldParentItem,
					before: before
				}));
			}

			return d;
		},

		// =======================================================================
		// Callbacks

		onChange: function(/*dojo/data/Item*/ /*===== item =====*/){
			// summary:
			//		Callback whenever an item has changed, so that Tree
			//		can update the label, icon, etc.   Note that changes
			//		to an item's children or parent(s) will trigger an
			//		onChildrenChange() so you can ignore those changes here.
			// tags:
			//		callback
		},

		onChildrenChange: function(/*===== parent, newChildrenList =====*/){
			// summary:
			//		Callback to do notifications about new, updated, or deleted items.
			// parent: dojo/data/Item
			// newChildrenList: Object[]
			//		Items from the store
			// tags:
			//		callback
		},

		onDelete: function(/*dojo/data/Item*/ /*===== item =====*/){
			// summary:
			//		Callback when an item has been deleted.
			//		Actually we have no way of knowing this with the new dojo.store API,
			//		so this method is never called (but it's left here since Tree connects
			//		to it).
			// tags:
			//		callback
		}
	});
});
