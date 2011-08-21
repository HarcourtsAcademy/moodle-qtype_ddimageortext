YUI.add('moodle-qtype_ddimagetoimage-dd', function(Y) {
    var DDIMAGETOIMAGEDDNAME = 'ddimagetoimage_dd';
    var DDIMAGETOIMAGE_DD = function() {
        DDIMAGETOIMAGE_DD.superclass.constructor.apply(this, arguments);
    }
    Y.extend(DDIMAGETOIMAGE_DD, Y.Base, {
        doc : null,
        polltimer : null,
        poll_for_image_load : function (e, waitforimageconstrain, pause, doafterwords) {
            var bgdone = this.doc.bg_img().get('complete');
            if (waitforimageconstrain) {
                bgdone = bgdone && this.doc.bg_img().hasClass('constrained');
            }
            var alldragsloaded = !this.doc.drag_image_homes().some(function(dragimagehome){
                //in 'some' loop returning true breaks the loop and is passed as return value from 
                //'some' else returns false. Can be though of as equivalent to ||.
                var done = (dragimagehome.get('complete'));
                if (waitforimageconstrain) {
                    done = done && dragimagehome.hasClass('constrained');
                }
                return !done;
            });
            if (alldragsloaded && alldragsloaded) {
                if (this.polltimer !== null) {
                    this.polltimer.cancel();
                    this.polltimer = null;
                }
                this.doc.drag_image_homes().detach('load', this.poll_for_image_load);
                this.doc.bg_img().detach('load', this.poll_for_image_load);
                if (pause !== 0) {
                    Y.later(pause, this, doafterwords);
                } else {
                    doafterwords.call(this);
                }
            } else if (this.polltimer === null) {
                var pollarguments = [null, waitforimageconstrain, pause, doafterwords];
                this.polltimer =
                            Y.later(500, this, this.poll_for_image_load, pollarguments, true);
            }
        },
        /**
         * Object to encapsulate operations on dd area.
         */
        doc_structure : function (mainobj) {
            var topnode = Y.one(this.get('topnode'));
            var dragimagesarea = topnode.one('div.dragitems');
            var dropbgarea = topnode.one('div.droparea');
            return {
                top_node : function() {
                    return topnode;
                },
                drag_images : function() {
                    return dragimagesarea.all('img.drag');
                },
                drop_zones : function() {
                    return topnode.all('div.dropzones div.dropzone');
                },
                drop_zone_group : function(groupno) {
                    return topnode.all('div.dropzones div.group' + groupno);
                },
                drag_images_cloned_from : function(dragimageno) {
                    return dragimagesarea.all('img.dragimages'+dragimageno);
                },
                drag_image : function(draginstanceno) {
                    return dragimagesarea.one('img.draginstance' + draginstanceno);
                },
                drag_image_homes : function() {
                    return dragimagesarea.all('img.draghome');
                },
                bg_img : function() {
                    return topnode.one('img.dropbackground');
                },
                load_bg_img : function (url) {
                    dropbgarea.setContent('<img class="dropbackground" src="'+ url +'"/>');
                    this.bg_img().on('load', this.on_image_load, this, 'bg_image');
                },
                add_or_update_drag_image_home : function (dragimageno, url, alt, group) {
                    var oldhome = this.drag_image_home(dragimageno);
                    var classes = 'draghome dragimagehomes'+dragimageno+' group'+group;
                    var imghtml = '<img class="'+classes+'" src="'+url+'" alt="'+alt+'" />';
                    if (oldhome === null) {
                        if (url) {
                            dragimagesarea.append(imghtml);
                        }
                    } else {
                        if (url) {
                            dragimagesarea.insert(imghtml, oldhome);
                        }
                        oldhome.remove(true);
                    }
                    var newlycreated = dragimagesarea.one('img.dragimagehomes'+dragimageno);
                    if (newlycreated !== null) {
                        newlycreated.setData('groupno', group);
                        newlycreated.setData('dragimageno', dragimageno);
                    }
                },
                drag_image_home : function (dragimageno) {
                    return dragimagesarea.one('img.dragimagehomes' + dragimageno);
                },
                get_classname_numeric_suffix : function(node, prefix) {
                    var classes = node.getAttribute('class');
                    if (classes !== '') {
                        var classesarr = classes.split(' ');
                        for (index in classesarr) {
                            var patt1 = new RegExp('^'+prefix+'([0-9])+$');
                            if (patt1.test(classesarr[index])) {
                                var patt2 = new RegExp('([0-9])+$');
                                var match = patt2.exec(classesarr[index]);
                                return +match[0];
                            }
                        }
                    }
                    throw 'Prefix "'+prefix+'" not found in class names.';
                },
                clone_new_drag_image : function (draginstanceno, dragimageno) {
                    var draghome = this.drag_image_home(dragimageno);
                    if (draghome === null) {
                        return null;
                    }
                    var drag = draghome.cloneNode(true);
                    drag.removeClass('dragimagehomes' + dragimageno);
                    drag.addClass('dragimages' + dragimageno);
                    drag.addClass('draginstance' + draginstanceno);
                    drag.removeClass('draghome');
                    drag.addClass('drag');
                    drag.setStyles({'visibility': 'visible', 'position' : 'absolute'});
                    drag.setData('draginstanceno', draginstanceno);
                    drag.setData('dragimageno', dragimageno);
                    draghome.get('parentNode').appendChild(drag);
                    return drag;
                },
                draggable_for_question : function (drag, group, choice) {
                    var dd = new Y.DD.Drag({
                        node: drag,
                        dragMode: 'intersect'
                    }).plug(Y.Plugin.DDConstrained, {constrain2node: topnode});
                    
                    dd.on('drag:end', function(e) {
                        mainobj.reposition_drags_for_question();
                    }, this);
                    drag.setData('group', group);
                    drag.setData('choice', choice);
    
                },
                draggable_for_form : function (drag) {
                    var dd = new Y.DD.Drag({
                        node: drag,
                        dragMode: 'intersect'
                    }).plug(Y.Plugin.DDConstrained, {constrain2node: topnode});
                    dd.on('drag:end', function(e) {
                        var dragnode = e.target.get('node');
                        var draginstanceno = dragnode.getData('draginstanceno');
                        var gooddrop = dragnode.getData('gooddrop');
                        var endxy;
                        
                        if (!gooddrop) {
                            mainobj.reset_drag_xy(draginstanceno);
                        } else {
                            endxy = [Math.round(e.pageX), Math.round(e.pageY)];
                            mainobj.set_drag_xy(draginstanceno, endxy);
                        }
                    }, this);
                    dd.on('drag:start', function(e) {
                        var drag = e.target;
                        drag.get('node').setData('gooddrop', false);
                    }, this);
                    
                }
    
            }
        },
    
        update_padding_sizes_all : function () {
            for (var groupno = 1; groupno <= 8; groupno++) {
                this.update_padding_size_for_group(groupno);
            }
        },
        update_padding_size_for_group : function (groupno) {
            var groupimages = this.doc.top_node().all('img.draghome.group'+groupno);
            if (groupimages.size() !== 0) {
                var maxwidth = 0;
                var maxheight = 0;
                groupimages.each(function(image){
                    maxwidth = Math.max(maxwidth, image.get('width'));
                    maxheight = Math.max(maxheight, image.get('height'));
                }, this);
                groupimages.each(function(image) {
                    var margintopbottom = Math.round((10 + maxheight - image.get('height')) / 2);
                    var marginleftright = Math.round((10 + maxwidth - image.get('width')) / 2);
                    image.setStyle('padding', margintopbottom+'px '+marginleftright+'px '
                                            +margintopbottom+'px '+marginleftright+'px');
                }, this);
                this.doc.drop_zone_group(groupno).setStyles({'width': maxwidth + 10,
                                                                'height': maxheight + 10});
            }
        },
        convert_to_window_xy : function (bgimgxy) {
            return [+bgimgxy[0] + this.doc.bg_img().getX() + 1,
                    +bgimgxy[1] + this.doc.bg_img().getY() + 1];
        }
    }, {
        NAME : DDIMAGETOIMAGEDDNAME,
        ATTRS : {
            drops : {value : null},
            readonly : {value : false},
            topnode : {value : null}
        }
    });
    M.qtype_ddimagetoimage = M.qtype_ddimagetoimage || {};
    M.qtype_ddimagetoimage.dd_base_class = DDIMAGETOIMAGE_DD;

    var DDIMAGETOIMAGEQUESTIONNAME = 'ddimagetoimage_question';
    var DDIMAGETOIMAGE_QUESTION = function() {
        DDIMAGETOIMAGE_QUESTION.superclass.constructor.apply(this, arguments);
    };
    Y.extend(DDIMAGETOIMAGE_QUESTION, M.qtype_ddimagetoimage.dd_base_class, {
        initializer : function(params) {
            this.doc = this.doc_structure(this);
            this.poll_for_image_load(null, false, 1000, this.create_all_drag_and_drops);
            this.doc.bg_img().after('load', this.poll_for_image_load, this,
                                                    false, 1000, this.create_all_drag_and_drops);
            this.doc.drag_image_homes().after('load', this.poll_for_image_load, this,
                                                    false, 1000, this.create_all_drag_and_drops);
            Y.on('windowresize', this.reposition_drags_for_question, this);
        },
        create_all_drag_and_drops : function () {
            this.init_drops();
            this.update_padding_sizes_all();
            var i = 0;
            this.doc.drag_image_homes().each(function(dragimagehome){
                var dragimageno = 
                    +this.doc.get_classname_numeric_suffix(dragimagehome, 'dragimagehomes');
                var choice = +this.doc.get_classname_numeric_suffix(dragimagehome, 'choice');
                var group = +this.doc.get_classname_numeric_suffix(dragimagehome, 'group')
                var groupsize = this.doc.drop_zone_group(group).size();
                var dragnode = this.doc.clone_new_drag_image(i, dragimageno);
                i++;
                if (!this.get('readonly')) {
                    this.doc.draggable_for_question(dragnode, group, choice);
                }
                if (dragnode.hasClass('infinite')) {
                    var dragstocreate = groupsize - 1;
                    while (dragstocreate > 0) {
                        dragnode = this.doc.clone_new_drag_image(i, dragimageno);
                        i++;
                        if (!this.get('readonly')) {
                            this.doc.draggable_for_question(dragnode, group, choice);
                        }
                        dragstocreate--;
                    }
                }
            }, this);
            this.reposition_drags_for_question();
        },
        reposition_drags_for_question : function() {
            this.doc.drag_images().removeClass('placed');
            this.doc.drag_images().each (function (dragimage) {
                if (dragimage.dd !== undefined) {
                    dragimage.dd.detachAll('drag:start');
                }
            }, this);
            this.doc.drop_zones().each(function(dropzone) {
                var relativexy = dropzone.getData('xy');
                dropzone.setXY(this.convert_to_window_xy(relativexy));
                var inputcss = 'input#' + dropzone.getData('inputid');
                var input = this.doc.top_node().one(inputcss);
                var choice = input.get('value');
                if (choice !== "") {
                    var group = dropzone.getData('group');
                    var dragimage = null;
                    var dragimages = this.doc.top_node()
                                        .all('div.dragitemgroup'+group+' img.choice'+choice+'.drag');
                    dragimages.some(function (d) {
                        if (!d.hasClass('placed')) {
                            dragimage = d;
                            return true;
                        } else {
                            return false;
                        }
                    });
                    if (dragimage !== null) {
                        dragimage.setXY(dropzone.getXY());
                        dragimage.addClass('placed');
                        if (dragimage.dd !== undefined) {
                            dragimage.dd.once('drag:start', function (e, input) {
                                input.set('value', '');
                                e.target.get('node').removeClass('placed');
                            },this, input);
                        }
                    }
                }
            }, this);
            this.doc.drag_images().each(function(dragimage) {
                if (!dragimage.hasClass('placed')) {
                    var dragimagehome = this.doc.drag_image_home(dragimage.getData('dragimageno'));
                    dragimage.setXY(dragimagehome.getXY());
                }
            }, this);
        },
        init_drops : function () {
            var dropareas = this.doc.top_node().one('div.dropzones');
            var groupnodes = {};
            for (var groupno =1; groupno <= 8; groupno++) {
                var groupnode = Y.Node.create('<div class = "dropzonegroup'+groupno+'"></div>');
                dropareas.append(groupnode);
                groupnodes[groupno] = groupnode;
            }
            for (var dropno in this.get('drops')){
                var drop = this.get('drops')[dropno];
                var nodeclass = 'dropzone group'+drop.group+' place'+dropno;
                var title = drop.text.replace('"', '\"');
                var dropnodehtml = '<div title="'+ title +'" class="'+nodeclass+'">&nbsp;</div>';
                var dropnode = Y.Node.create(dropnodehtml);
                groupnodes[drop.group].append(dropnode);
                dropnode.setStyles({'opacity': 0.5});
                dropnode.setData('xy', drop.xy);
                dropnode.setData('place', dropno);
                dropnode.setData('inputid', drop.fieldname.replace(':', '_'));
                dropnode.setData('group', drop.group);
                var dropdd = new Y.DD.Drop({
                      node: dropnode});
                dropdd.on('drop:hit', function(e) {
                    var drag = e.drag.get('node');
                    var drop = e.drop.get('node');
                    if (+drop.getData('group') === drag.getData('group')){
                        var inputid = drop.getData('inputid');
                        var inputnode = Y.one('input#'+inputid);
                        inputnode.set('value', drag.getData('choice'));
                    }
                }, this);
            };
        }
    }, {NAME : DDIMAGETOIMAGEQUESTIONNAME, ATTRS : {}});
    
    M.qtype_ddimagetoimage.init_question = function(config) { 
        return new DDIMAGETOIMAGE_QUESTION(config);
    }
}, '@VERSION@', {
      requires:['node', 'dd', 'dd-drop', 'dd-constrain']
});
