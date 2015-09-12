define(['dojo/_base/declare', 'dojo/_base/array', 'dijit/form/Select', 'dijit/Toolbar', 'dijit/form/DateTextBox',  'dijit/form/NumberTextBox', 
        'dijit/form/CheckBox', 'dijit/Editor', 'dijit/form/CurrencyTextBox', 'dijit/form/ValidationTextBox', 'dojo/dom-construct', "dojo/on", 
        "dojo/when", "dojo/query", 'dijit/registry', "app/nqWidgetBase", 'dijit/layout/ContentPane', "dojo/dom-geometry", "dojo/sniff", "dojo/_base/lang",
        "dojo/promise/all", "dojo/html", 'dojo/store/Memory', "dojo/dom-style","dojo/dom-attr",
        
        'dijit/_editor/plugins/TextColor', 'dijit/_editor/plugins/LinkDialog', 'dijit/_editor/plugins/ViewSource', 'dojox/editor/plugins/TablePlugins', 
        /*'dojox/editor/plugins/ResizeTableColumn'*/],
	function(declare, arrayUtil, Select, Toolbar, DateTextBox, NumberTextBox, 
			CheckBox, Editor, CurrencyTextBox, ValidationTextBox, domConstruct, on, 
			when, query, registry, nqWidgetBase, ContentPane, domGeometry, has, lang, 
			all, html, Memory, domStyle, domAttr){
   
	return declare("nqForm", [nqWidgetBase], {
		postCreate: function(){
			this.inherited(arguments);
			
			var item = null;
			var tableNode = domConstruct.create('table', {style: 'border-spacing:5px;'}, this.pane.containerNode);
			var self = this;
			this.getWidgetProperties(this.widgetId).then(function(widgetProps){
				console.log('widgetProp',widgetProps);
				self.widgetProps = widgetProps;
				widgetProps.views.forEach(function(view){
                    view.properties.forEach(function(property){
                        //console.dir('property',property);
                        // var attr = view.schema[attrName];
                        var row = domConstruct.create("tr", null, tableNode);
                        //the label
                        domConstruct.create("td", {innerHTML: (property.label), style: "padding: 3px"}, row);
                        //the dijit
                        var tdDom = domConstruct.create("td", {style: "padding: 3px; border-width:1px; border-color:lightgray; border-style:solid;"}, row);
                        var dijit = null;
                        if(property.dijitType == 'Select') {
                            dijit = new Select(property.editorArgs, domConstruct.create('div'));
                        }
                        else if(property.dijitType == 'RichText') {
                            self.editorToolbarDivNode.appendChild(property.editorArgs.toolbar.domNode);
                            dijit = new Editor(property, domConstruct.create('div', {name: property.name}));/*setting the name wont be done autoamticly*/
                            //						dijit.addStyleSheet('css/editor.css');
                            dijit.on("NormalizedDisplayChanged", function(event){
                                var height = domGeometry.getMarginSize(this.editNode).h;
                                if(has("opera")){
                                    height = this.editNode.scrollHeight;
                                }
                                //console.log('height',domGeometry.getMarginSize(this.editNode));
                                //this.resize({h: height});
                                domGeometry.setMarginBox(this.iframe, { h: height });
                            });
                            //dijit.destroy = function(){console.log('destroyed editor')};
                            domAttr.set(tdDom, 'colspan', '2');
                        }
                        else if(property.dijitType == 'String') {
                            var dijit = new ValidationTextBox(property, domConstruct.create('input'));
                        }
                        else if(property.dijitType == 'Number') {
                            dijit = new NumberTextBox(property, domConstruct.create('input'));
                        }
                        else if(property.dijitType == 'Date') {
                            dijit = new DateTextBox(property, domConstruct.create('input'));
                        }
                        if(dijit){
                            self.own(dijit);
                            tdDom.appendChild(dijit.domNode);
                            dijit.attributeReferenceId = property.name;
                            self.pane.own(dijit.on('change', function(value){
                                //self.item[this.attributeReferenceId] = value;
                                //self.store.put(self.item);
                            }));
                            //dijit.startup();will be call after add child and then from widget base
                        }
                        domConstruct.create("td", { innerHTML: (property.description), style: "padding: 3px", 'class': 'helpTextInvisable'}, row);
                    });
				});
				self.createDeferred.resolve(self);//ready to be loaded with data
			}, nq.errorDialog);
		},
		setSelectedObjIdPreviousLevel: function(value){
			//load the data
			//if(this.selectedObjIdPreviousLevel == value) return this;
			this.selectedObjIdPreviousLevel = value;
			
			var self = this;

			var collection = this.store.filter({itemId:this.selectedObjIdPreviousLevel});
			collection.on('update', function(event){
				var obj = event.target;
				self.onChange(obj);
			});	
			var children = collection.fetch();
			self.item = children[0];
			for(attrRefId in self.item){
				var attrQuery = "[name='"+attrRefId+"']";
				query(attrQuery).forEach(function(input){
					var wid = registry.getEnclosingWidget(input);
					var value = self.item[attrRefId];
					var widType = wid.declaredClass;
					/*console.log('widType', widType);
					if(!value){
						//if(widType == "dijit.form.Select") value = -1;
						if(widType == "dijit.form.ValidationTextBox") value = '[no value]';
						if(widType == "dijit.form.NumberTextBox") value = 'null';
						if(widType == "dijit.Editor") value = '<p>[no text]</p>';
					}*/
					wid.set('value',value, false);// do not fire change
				});
		    }
			self.setSelectedObjIdPreviousLevelDeferred.resolve(self);
			return this.setSelectedObjIdPreviousLevelDeferred.promise;
		}
	});

});
