define(["dojo/_base/declare", "app/nqWidgetBase", "dijit/Tree", 'dojo/_base/lang', "dijit/registry",/* 'app/nqObjectStoreModel',*/"dijit/tree/ObjectStoreModel", "dojo/hash","dojo/when", "dojo/promise/all",
        'dojo/dom-construct', 'dijit/tree/dndSource', 'dijit/Menu', 'dijit/MenuItem', 'dijit/PopupMenuItem', "dojo/_base/array",
        'dojo/query!css2'],
	function(declare, nqWidgetBase, Tree, lang, registry, ObjectStoreModel, hash, when, all,
			domConstruct, dndSource, Menu, MenuItem, PopupMenuItem, array){

	return declare("nqTree", [nqWidgetBase], {
		allowedClassesObj: {},//Check Item Acceptance needs this
		labelAttrIdArr: [], //get Label needs this
		permittedClassesByViewObj: {},
		attrRefByViewArr: [],
		parentId: null,
		
		postCreate: function(){
			this.inherited(arguments);
			var self = this;
			var initialized = self.store.get(self.widgetId).then(function(widget){
				self.widget = widget;
				//self.headerDivNode.innerHTML = widget.name;
				self.pageHelpTextDiv.innerHTML = widget.description;
				return self.store.getItemsByAssocTypeAndDestClass(self.widgetId, 'manyToMany', VIEW_CLASS_TYPE).then(function(viewsArr) {
					self.view = viewsArr[0]//for now assume only one view
                    return when(self.store.getCombinedSchemaForView(self.view),function(schema) {
					//return self.store.getCombinedSchemaForView(self.view).then(function(schema) {
                        self.enrichSchema(schema);
                        self.schema = schema;
                        var uViewsArr = [];
                        return self.store.getUniqueViewsForWidget(self.widgetId, uViewsArr).then(function(uniqueViewsArr){
							//console.log('uViewsArr',uViewsArr);
                            var viewPromises = [];
                            uViewsArr.forEach(function(uView){
                                viewPromises.push(self.permittedClassesForUniqueView(uView));
                            });
                            return all(viewPromises);
                        });
					});
				});
			});
            when(initialized, function(result){
                self.createMenusForWidget();
				self.createDeferred.resolve(self);//ready to be loaded with data
			}, function(err){self.createDeferred.reject(err)});
		},
        permittedClassesForUniqueView: function(uView){
            var self = this;
            self.store.getItemsByAssocTypeAndDestClass(uView._id, 'manyToMany', VIEW_CLASS_TYPE).then(function(manyViewsArr){
                var permClassesPromises = [];
                manyViewsArr.forEach(function(manyView){
                    if(manyView.mapsTo) permClassesPromises.push(self.store.collectAllByAssocType(manyView.mapsTo, 'subclasses'));
                });
                return all(permClassesPromises).then(function(permClassesArrArr){
                    //console.log('permClassesArrArr',permClassesArrArr);
                    var permObj = {};
                    var count = 0;
                    permClassesArrArr.forEach(function(permClassesArr){
                        var manyView = manyViewsArr[count];
                        permObj[manyView._id] = {view: manyView, classes: permClassesArr};
                        count++;
                    });
                    self.permittedClassesByViewObj[uView._id] = permObj;
                    //console.log('permObj',uView._id,permObj);
                    return true;
                });
            });
        },
		setSelectedObjIdPreviousLevel: function(value){
            var self = this;
            if(self.widget.parentId) {
                if(self.widget.parentId == this.selectedObjIdPreviousLevel) return this;
                else this.selectedObjIdPreviousLevel = Number(self.widget.parentId);
            }
            else if(!value || value == this.selectedObjIdPreviousLevel) return this;
			else this.selectedObjIdPreviousLevel = value;
			if(self.tree) self.tree.destroy(); 
			self.createTree();
			self.treeModel.query = {parentId: self.selectedObjIdPreviousLevel, viewId: this.widgetId};
			self.setSelectedObjIdPreviousLevelDeferred.resolve(self);
			return this.setSelectedObjIdPreviousLevelDeferred.promise;
		},
		setSelectedObjIdThisLevel: function(itemId){
            if(!itemId) return;
            var self = this;
            //var itemNode = this.tree.getNodesByItem[846];
            //console.log('itemNode', itemNode);
            //this.tree.set('path', [842, 1784, 2387, 846]);



            var promises = [];
            var viewsArr = [];
            //find the class of the current item
            promises.push(self.store.getItemsByAssocType(itemId, 'parent'));
            promises.push(self.store.getUniqueViewsForWidget(self.widgetId, viewsArr));
            var pathPromises = all(promises).then(function(promiseResults){
                var itemClass = promiseResults[0][0];
                var allowedClassesPromises = [];
                viewsArr.forEach(function(view){
                    if(view.mapsTo) allowedClassesPromises.push(self.store.collectAllByAssocType(view.mapsTo, 'subclasses'));
                });
                return all(allowedClassesPromises).then(function(allowedClassesArrArr){
                    var count = 0;
                    var restultsArr = [];
                    var treePathPromises = [];
                    allowedClassesArrArr.forEach(function(allowedClassesArr){
                        var view = viewsArr[count];
                        allowedClassesArr.forEach(function(allowedClass){
                            if(itemClass._id == allowedClass._id){
                                treePathPromises.push(self.store.getTreePath(view, itemId, restultsArr, 0));
                            }
                        });
                        count++;
                    });
                    return all(treePathPromises).then(function(tree){
                        return restultsArr;
                    });
                });
            });
            pathPromises.then(function(treePaths){
                console.log('treePaths',treePaths);
                if(treePaths[0] == 702) treePaths = [846,2016,702];
                self.tree.set('path', treePaths).then(function(results){
                    console.log('results',results);
                    //self.tree.set('selectedItem', result[results.length-1]);
                });
            }, nq.errorDialog);
		},
		createTree: function(){
			var self = this;
			this.treeModel = new ObjectStoreModel({
				childrenAttr: this.viewIdsArr,
				store : this.store,
				query : {itemId: this.selectedObjIdPreviousLevel, viewId: this.view._id}
			});
            this.treeModel.getIdentity = function(item){
                if(lang.isObject(item)) return item._id;
                return item; //hack to get Tree to respect numeric ids
            },
			this.treeModel.getRoot = function(onItem, onError){
				/*var collection = this.store.filter(this.query);
				collection.on('remove, add', function(event){
					var parent = event.parent;
					var collection = self.childrenCache[parent.id];
					if(collection){
						var children = collection.fetch();
						self.onChildrenChange(parent, children);
					}
				});	
				collection.on('update', function(event){
					var obj = event.target;
					self.onChange(obj);
				});	
				var children = collection.fetch();*/
                //this.store.getChildren({_id:self.selectedObjIdPreviousLevel, _viewId:self.widgetId}, onItem);

                if(self.selectedObjIdPreviousLevel==1) self.selectedObjIdPreviousLevel=67;
                self.store.get(self.selectedObjIdPreviousLevel).then(function(item) {
                    if(!item) onError('item not found');
                    else {
                        item._viewId = self.view._id;
                        onItem(item);
                    }
                });
			},
			this.treeModel.getChildren = function(/*Object*/ parentItem, /*function(items)*/ onComplete, /*function*/ onError){
                var self = this;
                //this.store.getChildren(parentItem, onComplete);
                //return;

				var id = this.store.getIdentity(parentItem);
/*
				if(this.childrenCache[id]){
					// If this.childrenCache[id] is defined, then it always has the latest list of children
					// (like a live collection), so just return it.
					//TODO why aren't my collections like a live collection? something is wrong  
					when(this.childrenCache[id], onComplete, onError);
					return;
				}
				var children = this.childrenCache[id] = this.store.getChildren(parentItem, onComplete);
                return;
                */
				var collection = this.childrenCache[parentItem._id];
				if(!collection) {
                    var query = {parentId: parentItem._id, parentViewId:parentItem._viewId};
                    collection = this.childrenCache[parentItem._id] = this.store.filter(query);
                    //collection = this.childrenCache[id] = this.store.getChildren(parentItem);
                    // Setup observer in case children list changes, or the item(s) in the children list are updated.
                    collection.on('remove, add', function(event){
                        var parent = event.directives.parent;
                        var collection = self.childrenCache[parent._id];
                        var query = {parentId: parent._id, parentViewId:parent._viewId};
                        collection = self.store.filter(query);
                        if(collection){
                            var children = collection.fetch();
                            self.onChildrenChange(parent, children);
                        }
                    });
                    collection.on('update', function(event){
                        var obj = event.target;
                        self.onChange(obj);
                    });
                }
				var children = collection.fetch();
				return onComplete(children);
			},
			this.tree = new Tree({
				id: 'tree'+this.widgetId,
				store: this.store,
                //model: this.store,
                model: this.treeModel,

				dndController: dndSource,
				betweenThreshold: 5, 
				persist: false,//doesnt deal well with recursion. Tends to expand everything
                getLabel: function(item){
                    if(!item) return 'no item';
                    if(item._type == 'object') return item.name;
                    return item._name;
                },
				getIconClass: function(item, opened){
					if(!item) return 'icondefault';
                    if(item._type == 'object') return 'icon'+item._icon;
					if(item._type == 'assoc') return 'icon'+item._icon;
					return 'icon0';
				},
				getRowClass: function(item, opened){
					if(!item) return '';
					return 'css'+item._viewId;//used by tree menu to determine which menu to show
				},
				getTooltip: function(item, opened){
					if(!item) return '';
					//return item.id+' - '+item.viewId+' - '+item.classId;
					if(dojo.config.isDebug) return item._id+' - '+item._viewId+' - '+item._icon;
				},
				onClick: function(item, node, evt){
					self.inherited('onClick',arguments);
					nq.setHashViewId(self.level, item._viewId, self.tabId, item._id);
				},
                mayHaveChildren: function(item){
                    //return 'children' in item;
                    return true;
                },
                checkItemAcceptance: function(target, source, position){
					return true;
					var targetItem = dijit.getEnclosingWidget(target).item;
					var subClassIdArr = self.allowedClassesObj[targetItem._viewId];
					var sourceItemClassId = source.current.item._iconId;
					//console.log('sourceItemClassId', sourceItemClassId);
					for(var i = 0;i<subClassArr.length;i++){
						var mapsToClassId = subClassArr[i].id;
						//console.log('mapsToClassId', mapsToClassId);
						if(mapsToClassId === sourceItemClassId) return true;
					}
					return false;
				},
				getRoot: function(onItem, onError){
                    self.store.get(self.selectedObjIdPreviousLevel).then(function(item) {
                        onItem(item);
                    });
				},
				onLoad: function(){
					fullPage.resize();//need this for lazy loaded trees, some how the first tree lags behind
					//console.dir(self.createDeferred.resolve(self));
//					self.createDeferred.resolve(self);//ready to be loaded with data/
//					self.setSelectedObjIdPreviousLevelDeferred.resolve(self);
				}
			}, domConstruct.create('div'));
			this.pane.containerNode.appendChild(this.tree.domNode);
//			this.tree.startup();

		},
		createMenusForWidget: function(){
			var self = this;
			for(var viewId in self.permittedClassesByViewObj) {
				var parentMenu = new Menu({targetNodeIds: [this.pane.containerNode], selector: ".css"+viewId});
				//var parentMenu = new Menu({targetNodeIds: [self.tree.domNode], selector: ".css"+viewId});
				var addMenu = new Menu({parentMenu: parentMenu});
				parentMenu.addChild(new PopupMenuItem({
					label:"Add New",
					iconClass:"addIcon",
					popup: addMenu
				}));
				parentMenu.addChild(new MenuItem({
					label:"Delete",
					iconClass:"removeIcon",
					onClick: function(){
						var selectedItem = self.tree.get("selectedItem");
						var directives = {parent:selectedItem};
						self.store.remove(selectedItem.id,selectedItem.viewId, directives);
					}
				}));
                var uViewObj = self.permittedClassesByViewObj[viewId];
                for(uViewId in uViewObj){
                    var manyViewObj = uViewObj[uViewId];
                    var manyView = manyViewObj.view;
                    var permittedClassesArr = manyViewObj.classes;
                    for(var i=0;i<permittedClassesArr.length;i++){
                        var classesObj = permittedClassesArr[i];

                        var menuItem = new MenuItem({
                            label: "<b>"+classesObj._name+"</b> by <span style='color:blue'>"+manyView.toMannyAssociations+"</span>",
                            iconClass: "icon"+classesObj._id,
                            classId: classesObj._id,
                            viewId: manyView._id
                        });
                        menuItem.on("click", function(evt){
                            var addObj = {
                                '_type': 'object',
                                '_viewId': this.viewId,
                                '_icon': this.classId
                            };
                            var selectedItem = self.tree.get("selectedItem");
                            var directives = {parent: selectedItem};
                            var newItem = self.store.add(addObj, directives);

                            var selectedNodes = self.tree.getNodesByItem(selectedItem);
                            if(!selectedNodes[0].isExpanded){
                                self.tree._expandNode(selectedNodes[0]);
                            }
                            self.tree.set('selectedItem', addObj._id);
                        });
                        addMenu.addChild(menuItem);
                    }
                }
			}
		}
	});
});
