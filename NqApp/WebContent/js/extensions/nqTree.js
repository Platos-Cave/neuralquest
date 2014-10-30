define(["dojo/_base/declare", "nq/nqWidgetBase", "dijit/Tree", 'dojo/_base/lang', "dijit/registry",/* 'nq/nqObjectStoreModel',*/"dijit/tree/ObjectStoreModel", "dojo/hash","dojo/when", "dojo/promise/all",  
        'dojo/dom-construct', 'dijit/tree/dndSource', 'dijit/Menu', 'dijit/MenuItem', 'dijit/PopupMenuItem', "dojo/_base/array", 
        'dojo/query!css2'],
	function(declare, nqWidgetBase, Tree, lang, registry, ObjectStoreModel, hash, when, all,
			domConstruct, dndSource, Menu, MenuItem, PopupMenuItem, array){

	return declare("nqTreeWidget", [nqWidgetBase], {
		allowedClassesObj: {},//Check Item Acceptance needs this
		labelAttrIdArr: [], //get Label needs this
		
		postCreate: function(){
			this.inherited(arguments);
			var self = this;
			when(this.getTheParentAttr(), function(parentId){
				self.selectedObjIdPreviousLevel = parentId;
				if(parentId){
					when(self.findTheLabels(), function(attrRefs){
						self.createTree();
						self.createMenus();
					}, nq.errorDialog);
				}
				else self.createDeferred.resolve(self);
			}, nq.errorDialog);
		},
		setSelectedObjIdPreviousLevel: function(value){
			var self = this;
			//var value = this.parentId;
			//load the data
			if(!value || value == this.selectedObjIdPreviousLevel) return this;
			this.selectedObjIdPreviousLevel = value;
			when(self.findTheLabels(), function(attrRefs){
				if(self.tree) self.tree.destroy(); 
				self.createTree();
				self.treeModel.query = {cellId: self.selectedObjIdPreviousLevel, viewId: self.viewIdsArr[0]};
//				self.tree.refreshModel();
				self.setSelectedObjIdPreviousLevelDeferred.resolve(self);
				self.createMenus();
			}, nq.errorDialog);
			return this.setSelectedObjIdPreviousLevelDeferred.promise;
		},
		setSelectedObjIdThisLevel: function(value){
			//select the node
			//TODO expand tree
			if(this.selectedObjIdThisLevel == value) return this;
			this.selectedObjIdThisLevel = value;
			if(value == 824) this.tree.set('path', ['810', '2016', '2020', '824']);
		},

		getTheParentAttr: function(){
			var PARENTID = 100;
			var self = this;
			//get the parentId that this widget has as an attribute
			return when(this.store.getOneByAssocTypeAndDestClass(this.widgetId, ATTRIBUTE_ASSOC, PARENTID), function(parentObjId){
				if(!parentObjId) return undefined;
				return when(self.store.getCell(parentObjId), function(parentCell){
					if(parentCell && parentCell.name!='') return parentCell.name;
					return undefined;
				});
			});
		},
		findTheLabels: function(){
			var OBJECT_TYPE = 1;
			
			var self = this;
			//recursivily get all of the views that belong to this widget
			return when(self.store.getManyByAssocType(self.widgetId, MANYTOMANY_ASSOC, OBJECT_TYPE, true), function(viewIdsArr){
				self.viewIdsArr = viewIdsArr;
				var attrRefPropertiesPromisses = [];
				for(var i=0;i<viewIdsArr.length;i++){
					var viewId = viewIdsArr[i];
					attrRefPropertiesPromisses.push(self.viewLabelPairs(viewId));
				}
				return all(attrRefPropertiesPromisses);
			});
		},
		viewLabelPairs: function(viewId){
			var ATTRREF_CLASS_TYPE = 63;
			var self = this;
			return when(this.store.getManyByAssocTypeAndDestClass(viewId, ORDERED_ASSOC, ATTRREF_CLASS_TYPE), function(attrRefsArr){
				self.labelAttrIdArr[viewId] = attrRefsArr[0];//assume the first attrRef is the label
			});
		},
		createTree: function(){
			var self = this;
			this.treeModel = new ObjectStoreModel({
				childrenAttr: this.viewIdsArr,
				store : this.store,
				query : {cellId: this.selectedObjIdPreviousLevel, viewId: this.viewIdsArr[0]}
			});
//			this.treeModel.getChildren = function(/*Object*/ parentItem, /*function(items)*/ onComplete, /*function*/ onError){
				// summary:
				//		Calls onComplete() with array of child items of given parent item.
				// parentItem:
				//		Item from the dojo/store
/*
				var id = this.store.getIdentity(parentItem);
//if(id==2453)debugger;
				if(this.childrenCache[id]){
					when(this.childrenCache[id], onComplete, onError);
					return;
				}

				var res = this.childrenCache[id] = this.store.getChildren(parentItem);

				// User callback
				when(res, onComplete, onError);

				// Setup listener in case children list changes, or the item(s) in the children list are
				// updated in some way.
				if(res.observe){
					res.observe(lang.hitch(this, function(obj, removedFrom, insertedInto){
						if(id==2453)debugger;
						console.log("observe on children of ", id, ": ", obj, removedFrom, insertedInto);

						// If removedFrom == insertedInto, this call indicates that the item has changed.
						// Even if removedFrom != insertedInto, the item may have changed.
						this.onChange(obj);

						if(removedFrom != insertedInto){
							// Indicates an item was added, removed, or re-parented.  The children[] array (returned from
							// res.then(...)) has already been updated (like a live collection), so just use it.
							when(res, lang.hitch(this, "onChildrenChange", parentItem));
							//when(res, function(children) {
							//	console.log("onChildrenChange", parentItem, children);
								//lang.hitch(this, "onChildrenChange", parentItem, children);
							//});
						}
					}), true);	// true means to notify on item changes
				}
			},
*/
//			this.treeModel.pasteItem = function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem,
//					/*Boolean*/ bCopy, /*int?*/ insertIndex, /*Item*/ before){
/*				if(!bCopy){
					var oldParentChildren = [].concat(this.childrenCache[this.getIdentity(oldParentItem)]), // concat to make copy
						index = array.indexOf(oldParentChildren, childItem);
					oldParentChildren.splice(index, 1);
					this.onChildrenChange(oldParentItem, oldParentChildren);
				}
				return this.store.put(childItem, {
					overwrite: true,
					parent: newParentItem,
					before: before,
					oldParentItem: oldParentItem//this is our extension
				});
			};*/
			this.tree = new Tree({
				id: 'tree'+this.widgetId,
				store: this.store,
				model: this.treeModel,
				dndController: dndSource,
				betweenThreshold: 5, 
				persist: 'true',
				getIconClass: function(item, opened){
					if(!item) return 'icondefault';
					return 'icon'+item.classId;
				},
				getRowClass: function(item, opened){
					if(!item) return '';
					return 'css'+item.viewId;//used by tree menu to determin which menu to show
				},
				getTooltip: function(item, opened){
					if(!item) return '';
					if(location.href.indexOf('localhost') >= 0) return item.id;
				},
				onClick: function(item, node, evt){
					self.inherited('onClick',arguments);
					nq.setHashViewId(self.level, item.viewId, self.tabId, item.id);
				},
				checkItemAcceptance: function(target, source, position){
					return true;
					var targetItem = dijit.getEnclosingWidget(target).item;
					var subClassIdArr = self.allowedClassesObj[targetItem.viewId];
					var sourceItemClassId = source.current.item.classId;
					//console.log('sourceItemClassId', sourceItemClassId);
					for(var i = 0;i<subClassArr.length;i++){
						var mapsToClassId = subClassArr[i].id;
						//console.log('mapsToClassId', mapsToClassId);
						if(mapsToClassId === sourceItemClassId) return true;
					}
					return false;
				},
				getLabel: function(item){
					if(!item) return 'no item';
					var labelAttrId = self.labelAttrIdArr[item.viewId];
					return item[labelAttrId];
				},
				onLoad: function(){
					fullPage.resize();//need this for lazy loaded trees, some how the first tree lags behind
					console.dir(self.createDeferred.resolve(self));
					self.createDeferred.resolve(self);//ready to be loaded with data/
//					self.setSelectedObjIdPreviousLevelDeferred.resolve(self);
				},
				refreshModel: function () {
					// reset the itemNodes Map
					this._itemNodesMap = {};
					// reset the state of the rootNode
//					this.rootNode.state = "UNCHECKED";
					// Nullify the tree.model's root-children
					this.model.root.children = null;
					// remove the rootNode
					if (this.rootNode) {
						this.rootNode.destroyRecursive();
					}
					// reload the tree
					this._load();
				}
			}, domConstruct.create('div'));
			this.pane.containerNode.appendChild(this.tree.domNode);
			this.tree.startup();
			this.createDeferred.resolve(this);//ready to be loaded with data

		},
		
		createMenus: function(){
			var OBJECT_TYPE = 1;
			var ASSOCS_ATTR_ID = 1613;
			var SUBCLASSES_PASSOC = 15;
			var ASSOCS_CLASS_TYPE = 94;
			var CLASS_TYPE = 0;
			var CELNAME_ATTR = 852;
			
			var self = this;
			when(self.store.getManyByAssocType(this.widgetId, MANYTOMANY_ASSOC, OBJECT_TYPE, true), function(viewIdArr){
				//console.log('getManyByAssocType', viewIdArr);					
				for(var i=0;i<viewIdArr.length;i++){
					viewId = viewIdArr[i];
					var parentMenu = new Menu({targetNodeIds: [self.tree.domNode], selector: ".css"+viewId});
					var attrPromises = [];
					//get the assocication type that this view has as an attribute
					attrPromises[0] = self.store.getOneByAssocTypeAndDestClass(viewId, ATTRIBUTE_ASSOC, ASSOCS_CLASS_TYPE);
					//get the class that this view maps to
					attrPromises[1] = self.store.query({sourceFk: viewId, type: MAPSTO_ASSOC});
					return when(all(attrPromises), function(arr){
						if(!arr[0]) throw new Error('View '+viewId+' must have an association type as an attribute ');
						var assocType = arr[0];
						if(arr[1].length!=1) throw new Error('View '+viewId+' must map to one class ');
						//if(arr[1].length!=1) console.log('View '+viewId+' should map to one class ');
						var destClassId = arr[1][0].destFk;
						//get the subclasses as seen from the destClass
						when(self.store.getManyByAssocType(destClassId, SUBCLASSES_PASSOC, CLASS_TYPE, true), function(subClassArr){
							self.allowedClassesObj[viewId] = subClassArr;//Check Item Acceptance needs this
							var classMenu = new Menu({parentMenu: parentMenu});
							for(var j=0;j<subClassArr.length;j++){
								var subClassId = subClassArr[j];
								//console.log(subClass);

								var tree = this.tree;
								var menuItem = new MenuItem({
									label: "A New <b>"+subClassId+"</b> Object",
									iconClass: "icon"+subClassId,
									subClassId: subClassId,
									viewId: viewId
								});
								menuItem.on("click", function(evt){
									console.log('menu item on', this.subClassId);
									var viewId = this.viewId;
									var classId = this.subClassId;
									var addObj = {
											'type': 1,
											'viewId': this.viewId, 
											'classId': this.subClassId
										};
									var selectedItem = self.tree.get("selectedItem");
									var directives = {parent:{id: selectedItem.id}};
	//								addObj[viewDefToCreate.label] = '[new '+subClassId+']';;
									var newItem = self.store.add(addObj, directives);
									
									//var selectedItem = self.tree.get("selectedItem");
									//if(!selectedItem[viewId]) selectedItem[viewId] = [];
									//selectedItem[viewId].push(newItem.id);
									//_nqDataStore.put(selectedItem);

									//TODO this should be done automaticly some where
									//var x = self.tree.model.getChildren(selectedItem, viewsArr);//we need this to create an observer on the newly created item
									
									var selectedNodes = self.tree.getNodesByItem(selectedItem);
									if(!selectedNodes[0].isExpanded){
										self.tree._expandNode(selectedNodes[0]);
									}
									self.tree.set('selectedItem', newItem.id);
								});
								classMenu.addChild(menuItem);	
							}
							classMenu.startup();
							parentMenu.addChild(new PopupMenuItem({
								label:"Add <span style='color:blue'>"+assocType+"</span> Relationship To",
								iconClass:"icon"+assocType,
								popup: classMenu
							}));
						}, nq.errorDialog);
						parentMenu.addChild(new MenuItem({
							label:"Delete",
							iconClass:"removeIcon",
							onClick: function(){
								//TODO
								var selectedItem = self.tree.get("selectedItem");
								self.store.remove(selectedItem.id);
								
								var parentItem = self.store.get(this.parentId);
								var viewId = self.viewDefToCreate.id;
								index = array.indexOf(parentItem[viewId], selectedItem.id);
								parentItem[viewId].splice(index, 1);
								self.store.put(parentItem);
							}
						}));
						parentMenu.startup();
					}, nq.errorDialog);
				}
			}, nq.errorDialog);		
		}
	});
});
