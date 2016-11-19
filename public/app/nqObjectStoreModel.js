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
            var collection = null;
            var query = self.schema.rootQuery;
            if(query) {
                var parentItem = this.store.cachingStore.getSync(this.docId);
                var clonedQuery = lang.clone(query);
                this.store.substituteVariablesInQuery(clonedQuery, parentItem, this.docId);
                var childrenFilter = self.store.buildFilterFromQuery(clonedQuery);
                collection = self.store.filter(childrenFilter);
            }
            else onItem([]);
			/*collection.on('remove, add', function(event){
				var parent = event.target;
				var collection = self.childrenCache[parent.id];
				if(collection){
					var children = collection.fetch();
					self.onChildrenChange(parent, children);
				}
			});*/
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
			if('$queryName' in parentItem) {
				if (parentItem.$queryName == 'rootQuery') query = self.schema.query;
				else {
					var prevQuery = self.getSubQueryByName(self.schema.query, parentItem.$queryName);
					if ('recursive' in prevQuery) {
						if(prevQuery.recursive == 'schemaQuery') query = self.schema.query;
						else if (prevQuery.recursive == 'same') query = prevQuery;
					}
					else if ('join' in prevQuery) query = prevQuery.join;
				}
			}
			else query = self.schema.query;
			if(!query) {
				var childrenArr = [];
				onComplete(childrenArr);
				return;
			}

            var clonedQuery = lang.clone(query);
            this.store.substituteVariablesInQuery(clonedQuery, parentItem, this.docId);
			var childrenPromises = [];

			if(Array.isArray(clonedQuery)){
                clonedQuery.forEach(function (subQuery) {
					childrenPromises.push(self.getChildrenArray(parentItem, subQuery));
				});
			}
			else childrenPromises.push(self.getChildrenArray(parentItem, clonedQuery));

			all(childrenPromises).then(function(childrenArrs){
				var resultingChildren = [];
				childrenArrs.forEach(function(childrenArr){
					resultingChildren = resultingChildren.concat(childrenArr);
				});
				onComplete(resultingChildren);
			});
        },

		getChildrenArray: function(parentItem, query) {
			var self = this;
			if('subDoc' in query) {
				var childObjects = parentItem[query.subDoc];
				if(!childObjects) return [];
				var newChildObjs = [];
				var num = 0;
				childObjects.forEach(function (childObj) {
					var newChildObj = lang.clone(childObj);
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
				var childrenFilter = self.store.buildFilterFromQuery(query);
				var childrenCollection = self.store.filter(childrenFilter);
				return childrenCollection.fetch().then(function (childObjects) {
                    var correctChildObjArr = [];
                    // in the case of in array, we have reorder because the query returns the natural order
                    if('in' in query.where){
                        var qualifier = query.where.in;
                        var key = Object.keys(qualifier)[0];
                        var correctOrder = qualifier[key];
                        childObjects.forEach(function(childObj){
                            var position = array.indexOf(correctOrder, childObj._id);
                            correctChildObjArr[position] = childObj;
                        });
                    }
                    else {
                        childObjects.forEach(function(childObj){
                            correctChildObjArr.push(childObj);
                        });
                    }
					var hasChildrenPromises = [];
                    correctChildObjArr.forEach(function (childObj) {
						//See if there are any grandchildren
						//hasChildrenPromises.push(self.hasGrandChildren(childObj, viewObj));
						hasChildrenPromises.push(true);
					});
					return all(hasChildrenPromises).then(function(hasChildrenPromisesArr){
						var counter = 0;
						var newChildObjs = [];
						hasChildrenPromisesArr.forEach(function(hasChildrenPromise){
							var newChildObj = lang.clone(correctChildObjArr[counter]);
                            newChildObj.$queryName = query.queryName;
							newChildObj.hasChildren = hasChildrenPromise;
							newChildObjs.push(newChildObj);
							counter ++;
						});
						return newChildObjs;
					});
				});
			}
			else return [];
		},
        hasGrandChildren: function(parentItem, viewObj) {
            //return true;
            var self = this;
            var grandChildrenPromises = [];
            if(viewObj.childrenQuery) {
				var grandChildrenFilter = self.store.buildFilterFromQuery(viewObj.childrenQuery);

				//var grandChildrenFilter = self.store.buildFilterFromQuery(parentItem, viewObj.childrenQuery);
                if(grandChildrenFilter) {
                    var grandChildrenCollection = self.store.filter(grandChildrenFilter);
                    grandChildrenPromises.push(grandChildrenCollection.fetch())
                }
            }
            if(viewObj.childrenView) {
                var subView = self.store.cachingStore.getSync(viewObj.childrenView);
                if(subView){
					var grandChildrenFilter = self.store.buildFilterFromQuery(subView.query, parentItem, subView.isA);

					//var grandChildrenFilter = self.store.buildFilterFromQuery(parentItem, subView.query);
                    if(grandChildrenFilter) {
                        var grandChildrenCollection = self.store.filter(grandChildrenFilter);
                        grandChildrenPromises.push(grandChildrenCollection.fetch())
                    }
                }
            }
            return all(grandChildrenPromises).then(function(grandChildrenArrs){
                var grandChildren = false;
                grandChildrenArrs.forEach(function(grandChildrenArr){
                    if(grandChildrenArr.length > 0) grandChildren = true;
                });
                return grandChildren;
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
