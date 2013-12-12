/***
 *  Project: jquery.dashboard.js
 *  Description: jQuery dashboard
 *  Author: Yuri Egorov <yuri.egorov@chtd.ru>
 *  Copyright: Chtd LLC., http://chtd.ru
 *  License: MIT (?)
 *
 *  http://bitbucket.org/chtd/jquery.dashboard
 *
 *  Dependencies:
 *      - jQuery 1.8+
 *      - jquery.event.drag.js and jquery.event.drop.js
 *        https://github.com/richardscarrott/jquery.threedubmedia (fork)
 *        https://github.com/threedubmedia/jquery.threedubmedia (original)
 *      - jquery.mousewheel.js
 *        https://github.com/brandonaaron/jquery-mousewheel
 *      - Bootstrap (optional, for buttons styles)
 *        http://getbootstrap.com/
 *      - FontAwesome (optional, for buttons icons)
 *        http://fortawesome.github.io/Font-Awesome/
 ***/

// jQuery plugin definition based on
// https://github.com/jquery-boilerplate/jquery-boilerplate/wiki/Extending-jQuery-Boilerplate


// TODO docs

;(function ($, window, document, undefined) {

    'use strict';

    var $window = $(window),
        pluginName = 'dashboard',
        dataPlugin = 'plugin_' + pluginName,
        dataChild = 'child_' + pluginName,
        makeBlockEvent = 'dashboard:makeblock',
        resizeWinEvent = 'resize.dashboard',
        resizedDashboardEvent = 'dashboard:resized',
        changeBlockEvent = 'block:change',
        rmBlockEvent = 'block:remove',
        cid = 0,
        zIndex = 0,
        states = {
            free: 0,
            selected: 1,
            occupied: 2
        },
        defaults = {
            childElement: 'div',
            childrenSelector: 'div',
            btnClass: 'btn btn-default btn-mini btn-xs',
            primaryBtnClass: 'btn-primary',
            iconStretchH: 'fa fa-arrows-h fa-fw',
            iconStretchV: 'fa fa-arrows-v fa-fw',
            iconStretchF: 'fa fa-expand fa-fw',
            iconDelete: 'fa fa-trash-o fa-fw',
            editor: false,
            grid: [20, 15],
            gutter: [10, 10]
        },
        topics = {};  // pub/sub container


    function getNextCid(prefix) {
        return (prefix || 'cn') + cid++;
    }

    // http://api.jquery.com/jQuery.Callbacks/
    function pubSub(id) {
        var topic = id && topics[id],
            callbacks,
            method;

        if (!topic) {
            callbacks = $.Callbacks();
            topic = {
                trigger: callbacks.fire,
                on: callbacks.add,
                off: callbacks.remove
            };
            if (id) {
                topics[id] = topic;
            }
        }
        return topic;
    };

    // http://stackoverflow.com/a/4298672
    function debouncer(func, timeout) {
        var timeoutID,
            timeout = timeout || 150;

        return function mkDebouncer() {
            var scope = this,
                args = arguments;
            clearTimeout(timeoutID);
            timeoutID = setTimeout(function debouncedCall() {
                func.apply(scope, Array.prototype.slice.call(args));
            }, timeout);
        }
    }


    $window.on(resizeWinEvent, debouncer(function notifyOnResize(event) {
        pubSub(resizedDashboardEvent).trigger();
    }));

    // http://stackoverflow.com/a/16640725
    function deCase(s) {
        return s.replace(/[A-Z]/g, function(a) {return '-' + a.toLowerCase()});
    }

    /***
     * Cell constructor
     *
     *
     *
     ***/
    function Cell(options) {
        this.column = options.col;  // column number
        this.row = options.row;  // row number
        this.width = options.width;  // cell width in pixels
        this.height = options.height;  // cell height in pixels

        this.cid = getNextCid();
        this._state = states.free;

        this.init();
    }

    $.extend(Cell.prototype, {
        init: function initCell() {
            var el = document.createElement('div');

            this.el = el;
            this.$el = $(el);

            el.className += ' db-grid-cell';
            el.style.width = this.width + 'px';
            el.style.height = this.height + 'px';
            el.style.left = this.column * this.width + 'px';
            el.style.top = this.row * this.height + 'px';

            this.attachDropEvents();
        },
        destroy: function destroy() {
            var $el = this.$el;

            this.$el = null;
            this.el = null;

            $el.off();
            $el.remove();
        },
        setState: function setState(state) {
            this._state = state;
            return this;
        },
        getState: function getState() {
            return this._state;
        },
        isFree: function isFree() {
            return this.getState() === states.free;
        },
        isSelected: function isSelected() {
            return this.getState() === states.selected;
        },
        isOccupied: function isOccupied() {
            return this.getState() === states.occupied;
        },
        setFree: function setFree() {
            return this.setState(states.free);
        },
        setSelected: function setSelected() {
            return this.setState(states.selected);
        },
        setOccupied: function setOccupied() {
            return this.setState(states.occupied);
        },
        getPos: function getPosition() {
            return {col: this.column, row: this.row};
        },
        attachDropEvents: function attachDropEvents() {
            var this_ = this;

            this.$el.on('dropstart.dashboard.cell', function callOnDropStart(ev, dd){
                return this_.onDropStart.apply(this_, arguments);
            })
            .on('dropend.dashboard.cell', function callOnDropEnd(ev, dd){
                this_.onDropEnd.apply(this_, arguments);
            })
            .on('drop.dashboard.cell', function(ev, dd){
                this_.onDrop.apply(this_, arguments);
            });
        },
        onDropStart: function onDropStart(ev, dd) {
            if (!this.isFree() || dd.isBlock) {
                return false;
            } else {
                this.el.className += ' db-grid-cell-selected';
            }
        },
        onDropEnd: function onDropEnd(ev, dd) {
            this.el.className = this.el.className.replace('db-grid-cell-selected', '');
        },
        onDrop: function onDrop(ev, dd) {
            this.setSelected();
        }
    });


    /***
     * Grid container constructor
     *
     *
     *
     ***/
    function Grid(options) {
        var cell = options.cell,
            size = options.size;

        this._numCols = size[0];  // number of columns
        this._numRows = size[1];  // number of rows
        this._cellWidth = cell[0];  // cell width
        this._cellHeight = cell[1];  // cell height
        this._width = this._numCols * this._cellWidth;  // grid full width
        this._height = this._numRows * this._cellHeight;  // grid full height

        this.evtPrefix = options.evtPrefix;  // pub/sub events prefix

        this.init();
    }

    $.extend(Grid.prototype, {
        init: function initBlocks() {
            var el = document.createElement('div'),
                opts,
                cell,
                i,
                j;

            this.cid = getNextCid();

            this.children = [];
            this._childrenByCid = {};

            this.el = el;
            this.$el = $(el);

            el.className += ' db-grid';
            el.className += ' db-grid-bordered';

            el.style.width = this._width + 'px';
            el.style.height = this._height + 'px';

            for (i=0; i<this._numRows; i++) {
                for (j=0; j<this._numCols; j++) {
                    opts = {
                        col: j,
                        row: i,
                        width: this._cellWidth,
                        height: this._cellHeight
                    };
                    cell = new Cell(opts);
                    this.children.push(cell);
                    this._childrenByCid[cell.cid] = cell;
                }
            }

            this.attachDragEvents();
        },
        destroy: function destroy() {
            var $el = this.$el,
                children = this.children,
                childrenByCid = this._childrenByCid;

            this.children = null;
            this._childrenByCid = null;
            this.$el = null;
            this.el = null;

            $.each(children, function rmChild(idx, child) {
                var cid = child.cid;

                childrenByCid[cid] = null;

                child.destroy();
            });

            $el.off();
            $el.remove();
        },
        render: function renderGrid() {
            var frag = document.createDocumentFragment(),
                cell,
                i,
                j;

            for (i=0; i<this.children.length; i++) {
                cell = this.children[i];
                frag.appendChild(cell.el);
            }
            this.el.appendChild(frag);

            return this;
        },
        getSelected: function getSelected() {
            var selected = [];

            $.each(this.children, function filterSelected(idx, cell) {
                if (cell.isSelected()) {
                    selected.push(cell);
                }
            });
            return selected;
        },
        setOccupied: function setOccupied(cells) {
            $.each(cells, function setState(idx, cell) {
                cell.setOccupied();
            });
        },
        setFree: function setOccupied(cells) {
            $.each(cells, function setState(idx, cell) {
                cell.setFree();
            });
        },
        makeBlock: function makeBlock(cells) {
            var block,
                top_,
                left,
                bottom,
                right;

            $.each(cells, function getPos(idx, cell) {
                var pos = cell.getPos();
                if (idx === 0) {
                    top_ = bottom = pos.row;
                    left = right = pos.col;
                } else {
                    top_ = Math.min(top_, pos.row);
                    bottom = Math.max(bottom, pos.row);
                    left = Math.min(left, pos.col);
                    right = Math.max(right, pos.col);
                }
            });

            block = {
                dbTop: top_,
                dbLeft: left,
                dbWidth: right - left + 1,
                dbHeight: bottom - top_ + 1
            };
            pubSub(this.evtPrefix + makeBlockEvent).trigger(block);
        },
        attachDragEvents: function attachDragEvents() {
            var this_ = this;

            this.$el.on('dragstart', function callOnDragStart(ev, dd) {
                return this_.onDragStart.apply(this_, arguments);
            })
            .on('dragend', function callOnDragEnd(ev, dd){
                this_.onDragEnd.apply(this_, arguments);
            })
            .on('drag', function callOnDrag(ev, dd){
                this_.onDrag.apply(this_, arguments);
            });
        },
        onDragStart: function onDragStart(ev, dd) {
            return $('<div class="db-grid-selection" />').appendTo(document.body);
        },
        onDragEnd: function onDragEnd(ev, dd) {
            var cells = this.getSelected();
            this.makeBlock(cells);
            this.setFree(cells);
            $(dd.proxy).remove();
        },
        onDrag: function onDrag(ev, dd) {
            $(dd.proxy).css({
                top: Math.min(ev.pageY, dd.startY),
                left: Math.min(ev.pageX, dd.startX),
                height: Math.abs(ev.pageY - dd.startY),
                width: Math.abs(ev.pageX - dd.startX)
            });
        },
        toggleGrid: function toggleGrid() {
            this.$el.toggleClass('db-grid-bordered');
            return this;
        },
        clearGrid: function clearGrid() {
            $.each(this.children, function makeFree(k, child) {
                child.setFree();
            });
            return this;
        }
    });


    /***
     * Dashboard block constructor
     *
     *
     *
     ***/
    function Block(element, options) {
        var classes;

        this.evtPrefix = options.evtPrefix;

        this.top_ = parseInt(options.dbTop, 10);
        this.left = parseInt(options.dbLeft, 10);
        this.width = parseInt(options.dbWidth, 10);
        this.height = parseInt(options.dbHeight, 10);

        this.cellWidth = options.cell.width;
        this.cellHeight = options.cell.height;

        this.gutterWidth = options.gutter.width;
        this.gutterHeight = options.gutter.height;

        this.halfGutterWidth = Math.round(this.gutterWidth / 2);
        this.halfGutterHeight = Math.round(this.gutterHeight / 2);

        this.numCols = options.grid.cols;
        this.numRows = options.grid.rows;

        this.el = element || document.createElement(options.blockElement);

        this.editable = options.editable || false;

        this.stretch = options.dbStretch;

        this.btnClass = options.btnClass;
        this.primaryBtnClass = options.primaryBtnClass;

        this.iconClasses = classes = [];

        $.each(['iconStretchH', 'iconStretchV', 'iconStretchF', 'iconDelete'], function bindClass(idx, className) {
            var btnClass = deCase(className),
                stretch = (btnClass.indexOf('stretch') !== -1) ? btnClass[btnClass.length - 1] : null;

            if (stretch) {
                btnClass = 'db-block-stretch db-block-btn';
            } else {
                btnClass = btnClass.replace('icon', 'db-block') + ' db-block-btn ';
            }
            classes.push({btn: btnClass, icon: options[className], stretch: stretch});
        });


        this.init();
    }

    $.extend(Block.prototype, {
        init: function initBlock() {

            this.$el = $(this.el);

            this.cid = getNextCid();
            this._controls = [];

            this.el.className += ' db-block';
            this.el.style.zIndex = zIndex++;

            this.placeBlock();

            if (this.editable) {
                this.attachHandlers();
            } else {
                if (this.stretch) {
                    this.attachStretchHandler();
                }
            }
        },
        getPos: function getPos() {
            return {
                dbTop: this.top_,
                dbLeft: this.left,
                dbWidth: this.width,
                dbHeight: this.height
            };
        },
        setPos: function setPos(t, l, w, h) {
            this.top_ = t;
            this.left = l;
            this.width = w;
            this.height = h;
            return this;
        },
        updatePos: function updatePos(cell) {
            this.cellWidth = cell.width;
            this.cellHeight = cell.height;

            return this.placeBlock();
        },
        placeBlock: function placeBlock() {
            var el = this.el,
                bw = this.cellWidth,
                bh = this.cellHeight,
                gw = this.gutterWidth,
                gh = this.gutterHeight,
                hgw = this.halfGutterWidth,
                hgh = this.halfGutterHeight,
                top_ = (bh * this.top_) + hgh,
                left = (bw * this.left) + hgw,
                width = bw * this.width - gw,
                height = bh * this.height - gh;

            this.el.style.top = top_ + 'px';
            this.el.style.left = left + 'px';
            this.el.style.width = width + 'px';
            this.el.style.height = height + 'px';

            return this;
        },
        attachHandlers: function attachHandlers() {
            var this_ = this;
            this.$el.
                on('mouseenter.dashboard.block', function callOnMouseEnter() {
                    this_.onMouseEnter.apply(this_, arguments);
                }).
                on('mouseleave.dashboard.block', function callOnMouseLeave() {
                    this_.onMouseLeave.apply(this_, arguments);
                });
            return this;
        },
        detachHandlers: function detachHandlers() {
            this.$el.off('.dashboard.block');
            this.removeControls();
            return this;
        },
        onMouseEnter: function onMouseEnter(event) {
            this.makeControls();
        },
        onMouseLeave: function onMouseLeave(event) {
            if (!this._moveResizePending) {
                this.removeControls();
            }
        },
        getDragLimits: function getDragLimits() {
            // limits in terms of cells
            return {
                top: 0,
                left: 0,
                bottom: this.numRows - this.height,
                right: this.numCols - this.width
            };
        },
        getResizeLimits: function getResizeLimits() {
            return {
                w: [-this.left, this.width - 1],
                n: [-this.top_, this.height - 1],
                e: [-this.width + 1, this.numCols - this.left - this.width],
                s: [-this.height + 1, this.numRows - this.top_ - this.height]
            };
        },
        makeControls: function makeControls() {
            var controls = this._controls,
                btnClass = this.btnClass,
                primary = this.primaryBtnClass,
                currentStretch = this.stretch,
                frag = document.createDocumentFragment(),
                mover = document.createElement('div'),
                buttons = document.createElement('div'),
                handlers = ['w', 'e', 'n', 's', 'nw', 'ne', 'sw', 'se'];

            $.each(handlers, function mkHandler(k, place) {
                var div = document.createElement('div');

                div.className += ' db-block-resizer';
                div.className += ' db-block-resizer-' + place;
                div.setAttribute('data-direction', place);

                controls.push(div);
                frag.appendChild(div);
            });

            mover.className += ' db-block-mover';
            frag.appendChild(mover);
            controls.push(mover);

            buttons.className += ' db-block-controls';
            $.each(this.iconClasses, function mkBtn(idx, conf) {
                var btn = document.createElement('button'),
                    icn = document.createElement('i');
                btn.className += ' ' + btnClass + ' ' + conf.btn;
                if (conf.stretch) {
                    btn.setAttribute('data-stretch', conf.stretch);
                    if (conf.stretch === currentStretch) {
                        btn.className += ' ' + primary;
                    }
                }
                icn.className += ' ' + conf.icon;
                btn.appendChild(icn);
                buttons.appendChild(btn);
            });
            frag.appendChild(buttons);
            controls.push(buttons);

            this.el.appendChild(frag);

            this.attachResizeHandlersEvents();
            this.attachMoveHandlerEvents();
            this.attachButtonsEvents();

            return this;
        },
        removeControls: function removeControls() {
            var el = this.el;

            this.detachButtonsEvents();
            this.detachMoveHandlerEvents();
            this.detachResizeHandlersEvents();

            $.each(this._controls, function rmControl(k, div) {
                el.removeChild(div);
            });

            this._controls = [];
            this._removeHandlersOnResize = false;
        },
        attachMoveHandlerEvents: function attachMoveHandlerEvents() {
            var this_ = this,
                mover = this.$el.find('.db-block-mover');

            mover.on('dragstart.dashboard.block',
                   {drop: false, relative: true},
                        function callOnDragStart() {
                            return this_.onDragStart.apply(this_, arguments);
                }).
                on('dragend.dashboard.block', function callOnDragEnd() {
                    this_.onDragEnd.apply(this_, arguments);
                }).
                on('drag.dashboard.block', function callOnDrag() {
                    this_.onDrag.apply(this_, arguments);
                });
        },
        detachMoveHandlerEvents: function detachMoveHandlerEvents() {
            this.$el.find('.db-block-mover').off('.dashboard.block');
        },
        bringToFront: function bringToFront() {
            this.el.style.zIndex = zIndex++;
            return this;
        },
        onDragStart: function onDragStart(ev, dd) {
            this._moveResizePending = true;
            this.bringToFront();

            dd.limit = this.getDragLimits();
            dd.newPos = {
                top: this.top_,
                left: this.left
            };
        },
        onDrag: function onDrag(ev, dd) {
            var cellsX = Math.round(dd.deltaX / this.cellWidth),
                cellsY = Math.round(dd.deltaY / this.cellHeight),
                newTop = this.top_ + cellsY,
                newLeft = this.left + cellsX,
                newPos = dd.newPos,
                limit = dd.limit,
                updatedTop = newTop < 0 ? limit.top : newTop > limit.bottom ? limit.bottom : newTop,
                updatedLeft = newLeft < 0 ? limit.left : newLeft > limit.right ? limit.right : newLeft,
                props = {
                    top: updatedTop * this.cellHeight + this.halfGutterHeight + 'px',
                    left: updatedLeft * this.cellWidth + this.halfGutterWidth + 'px'
                };
            this.$el.css(props);
            newPos.top = updatedTop;
            newPos.left = updatedLeft;
        },
        onDragEnd: function onDragEnd(ev, dd) {
            var newPos = dd.newPos,
                updatedTop = newPos.top,
                updatedLeft = newPos.left;
            this.top_ = updatedTop;
            this.left = updatedLeft;
            this._moveResizePending = false;

            pubSub(this.evtPrefix + changeBlockEvent).trigger(this);
        },
        attachResizeHandlersEvents: function attachResizeHandlers() {
            var this_ = this,
                $resizers = this.$el.find('.db-block-resizer');

            $resizers.on('dragstart.dashboard.block',
                         {drop: false, relative: true},
                         function callOnResizeStart() {
                            return this_.onResizeStart.apply(this_, arguments);
            }).
            on('dragend.dashboard.block', function callOnDragEnd() {
                this_.onResizeEnd.apply(this_, arguments);
            }).
            on('drag.dashboard.block', function callOnResize() {
                this_.onResize.apply(this_, arguments);
            });
        },
        detachResizeHandlersEvents: function detachResizeHandlers() {
            this.$el.find('.db-block-resizer').off('.dashboard.block');
        },
        onResizeStart: function onResizeStart(ev, dd) {
            var target = ev.target,
                direction = target.getAttribute('data-direction');

            this._moveResizePending = true;
            this.bringToFront();

            dd.resizeDirection = direction;
            dd.limit = this.getResizeLimits();
            dd.newPos = {
                top: this.top_,
                left: this.left,
                width: this.width,
                height: this.height
            };
        },
        onResize: function onResize(ev, dd) {
            var direction = dd.resizeDirection,
                limit = dd.limit,
                props = {},
                cellsX = Math.round(dd.deltaX / this.cellWidth),
                cellsY = Math.round(dd.deltaY / this.cellHeight),
                newPos = dd.newPos,
                newTop,
                newLeft,
                newWidth,
                newHeight;

            if (direction.indexOf('e') > -1){
                cellsX = cellsX < limit.e[0] ? limit.e[0] : cellsX > limit.e[1] ? limit.e[1] : cellsX;
                newPos.width = this.width + cellsX;
                props.width = newPos.width * this.cellWidth - this.gutterWidth + 'px';
            }
            if (direction.indexOf('s') > -1){
                cellsY = cellsY < limit.s[0] ? limit.s[0] : cellsY > limit.s[1] ? limit.s[1] : cellsY;
                newPos.height = this.height + cellsY;
                props.height = newPos.height * this.cellHeight - this.gutterWidth + 'px';
            }
            if (direction.indexOf('w') > -1){
                cellsX = cellsX < limit.w[0] ? limit.w[0] : cellsX > limit.w[1] ? limit.w[1] : cellsX;

                newPos.left = this.left + cellsX;
                newPos.width = this.width - cellsX;
                props.left = newPos.left * this.cellWidth + this.halfGutterWidth + 'px';
                props.width = newPos.width * this.cellWidth - this.gutterWidth + 'px';
            }
            if (direction.indexOf('n') > -1){
                cellsY = cellsY < limit.n[0] ? limit.n[0] : cellsY > limit.n[1] ? limit.n[1] : cellsY;

                newPos.top_ = this.top_ + cellsY;
                newPos.height = this.height - cellsY;
                props.top = newPos.top_ * this.cellHeight + this.halfGutterWidth + 'px';
                props.height = newPos.height * this.cellHeight - this.gutterWidth + 'px';
            }
            this.$el.css(props);
        },
        onResizeEnd: function onResizeEnd(ev, dd) {
            var newPos = dd.newPos;

            this._moveResizePending = false;

            this.left = newPos.left || this.left;
            this.width = newPos.width || this.width;
            this.top_ = newPos.top_ || this.top_;
            this.height = newPos.height || this.height;

            if (this._removeHandlersOnResize) {
                this.removeResizeHandlers();
            }
            pubSub(this.evtPrefix + changeBlockEvent).trigger(this);
        },
        attachButtonsEvents: function attachButtonsEvents() {
            var this_ = this,
                delBtn = this.$el.find('.db-block-delete'),
                stretchBtns = this.$el.find('.db-block-stretch');

            delBtn.on('click.dashboard.block', function callOnDelete() {
                this_.onDelete.apply(this_, arguments);
            });
            stretchBtns.on('click.dashboard.block', function callOnSetStretch() {
                this_.onSetStretch.apply(this_, arguments);
            });
        },
        detachButtonsEvents: function detachButtonsEvents() {
            this.$el.find('.db-block-btn,.db-block-stretch').off('.dashboard.block');
        },
        onDelete: function onDelete(event) {
            event.preventDefault();
            pubSub(this.evtPrefix + rmBlockEvent).trigger(this.cid);
        },
        onSetStretch: function onSetStretch(event) {
            event.preventDefault();

            var $btn = $(event.currentTarget),
                primary = this.primaryBtnClass,
                stretch = $btn.data('stretch');

            this.stretch = stretch === this.stretch ? null : stretch;

            $btn.siblings().removeClass(primary);
            if (this.stretch) {
                $btn.addClass(primary);
            } else {
                $btn.removeClass(primary);
            }

            pubSub(this.evtPrefix + changeBlockEvent).trigger(this);
        },
        attachStretchHandler: function attachStretchHandlers() {
            var this_ = this;
            this.$el.
                on('mouseenter.dashboard.block.stretch', function callOnMouseEnter() {
                    this_.stretchOnMouseEnter.apply(this_, arguments);
                }).
                on('mouseleave.dashboard.block.stretch', function callOnMouseLeave() {
                    this_.stretchOnMouseLeave.apply(this_, arguments);
                });
            return this;
        },
        detachStretchHandler: function detachStretchHandlers() {
            this.$el.off('.dashboard.block.stretch');
            return this;
        },
        stretchOnMouseEnter: function onMouseEnter(event) {
            this._savedPlacement = this.getPos();

            if (this.stretch === 'f') {
                this.setPos(0, 0, this.numCols, this.numRows);
            } else if (this.stretch === 'v') {
                this.setPos(0, this.left, this.width, this.numRows);
            } else if (this.stretch === 'h') {
                this.setPos(this.top_, 0, this.numCols, this.height);
            }
            this.bringToFront().placeBlock();
        },
        stretchOnMouseLeave: function onMouseLeave(event) {
            var saved = this._savedPlacement;
            this._savedPlacement = null;
            this.setPos(saved.dbTop, saved.dbLeft, saved.dbWidth, saved.dbHeight);
            this.placeBlock();
        },
        setEditable: function setEditable() {
            this.editable = true;
            this.attachHandlers();
            if (this.stretch) {
                this.detachStretchHandler();
            }
            return this;
        },
        unsetEditable: function unsetEditable() {
            this.editable = false;
            this.detachHandlers();
            if (this.stretch) {
                this.attachStretchHandler();
            }
            return this;
        },
        toJSON: function toJSON() {
            var p = this.getPos();

            if (this.stretch) {
                p.stretch = this.stretch;
            }
            return p;
        },
        destroy: function destroyBlock() {
            this.detachHandlers();
            this.$el.remove();
            this.$el = null;
            this.el = null;
        }
    });


    /***
     * jQuery Dashboard plugin
     *
     *
     *
     ***/
    function Plugin(element, options) {

        this.element = element;
        this.$element = $(element);
        this.options = $.extend({}, defaults, options);

        this._defaults = defaults;
        this._name = pluginName;

        this.cid = getNextCid('db');
        this.evtPrefix = 'dashboard:' + this.cid + ':';

        this.init();
    }

    Plugin.prototype = {
        _calcDimensions: function calcDimensions() {
            var $el = this.$element,
                options = this.options,
                grid = options.grid,
                gutter = options.gutter,
                width = $el.width(),
                height = $el.height(),
                offset = $el.offset(),
                numCols = grid[0],
                numRows = grid[1],
                cellWidth = parseInt(width / numCols, 10),
                cellHeight = parseInt(height / numRows, 10);

            if (cellWidth < 10) {
                $.error('Calculated block width is too small! Please decrease number of blocks in a row.');
            }
            if (cellHeight < 10) {
                $.error('Calculated block height is too small! Please decrease number of blocks in a column.');
            }

            this._numCols = numCols;
            this._numRows = numRows;

            this._width = width;
            this._height = height;
            this._offset = offset;

            this._cellWidth = cellWidth;
            this._cellHeight = cellHeight;

            this._gutterWidth = gutter[0];
            this._gutterHeight = gutter[1];

            return this;
        },
        _makeGrid: function makeGrid() {
            var opts = {
                evtPrefix: this.evtPrefix,
                size: [this._numCols, this._numRows],
                cell: [this._cellWidth, this._cellHeight]
            };

            this.grid = new Grid(opts);
            this.$element.prepend(this.grid.render().el);

            return this._attachGridHandlers();
        },
        _attachGridHandlers: function attachGridHandlers() {
            var this_ = this,
                makeBlockCaller = function callMakeBlock() {
                    this_.makeBlock.apply(this_, arguments);
                };

            if (this.grid) {
                this._makeBlockCaller = makeBlockCaller;
                pubSub(this.evtPrefix + makeBlockEvent).on(this._makeBlockCaller);
            }
            return this;
        },
        _removeGrid: function removeGrid() {
            this._detachGridHandlers();
            this.grid.destroy();
            this.grid = null;
            return this;
        },
        _detachGridHandlers: function detachGridHandlers() {
            if (this.grid) {
                pubSub(this.evtPrefix + makeBlockEvent).off(this._makeBlockCaller);
                this._makeBlockCaller = null;
            }
            return this;
        },
        _setBlocksEditable: function setBlocksEditable() {
            $.each(this.children, function setEditable(idx, child) {
                child.setEditable();
            });
            return this;
        },
        _unsetBlocksEditable: function unsetBlocksEditable() {
            $.each(this.children, function unsetEditable(idx, child) {
                child.unsetEditable();
            });
            return this;
        },
        onResize: function onResize() {
            var cell = {};

            this._calcDimensions();

            cell.width = this._cellWidth;
            cell.height = this._cellHeight;

            if (this.options.editor) {
                this._removeGrid();
                this._makeGrid();
            }

            $.each(this.children, function updatePos(idx, child) {
                child.updatePos(cell);
            });
        },
        init: function initPlugin() {
            var this_ = this,
                opts = this.options,
                editor = opts.editor,
                grid = opts.grid,
                gutter = opts.gutter;

            if (!$.isArray(grid) || grid.length !== 2) {
                $.error('options.grid must be an Array of 2 elements!');
            }
            if (!$.isArray(gutter) || gutter.length !== 2) {
                $.error('options.gutter must be an Array of 2 elements!');
            }

            this.children = [];

            this._calcDimensions();

            if (editor) {
                this._makeGrid();
                this._setBlocksEditable();
            }

            this._invalidate();

            this._onResizeCaller = function callOnResized() {
                this_.onResize.apply(this_, arguments);
            };
            this._onBlockRemoveCaller = function callOnBlockRemove() {
                this_._onBlockRemove.apply(this_, arguments);
            };
            this._onBlockChangedCaller = function callOnBlockChanged() {
                this_._onBlockChanged.apply(this_, arguments);
            };

            pubSub(resizedDashboardEvent).on(this._onResizeCaller);
            pubSub(this.evtPrefix + rmBlockEvent).on(this._onBlockRemoveCaller);
            pubSub(this.evtPrefix + changeBlockEvent).on(this._onBlockChangedCaller);
        },
        destroy: function destroyPlugin() {
            var el = this.element,
                children = this.children;

            pubSub(resizedDashboardEvent).off(this._onResizeCaller);
            pubSub(this.evtPrefix + rmBlockEvent).off(this._onBlockRemoveCaller);

            this._onResizeCaller = null;
            this._onBlockRemoveCaller = null;

            this._removeGrid();
            this.$element.data(dataPlugin, null);
            this.element = null;
            this.options = null;
            this._defaults = null;
            this._children = null;
            this.grid = null;

            $.each(children, function iterChildren(k, v) {
                v.child.data(dataChild, null);
                v.child = null;
                children[k] = null;
            });
            return el;
        },
        _invalidate: function invalidatePlugin() {
            var this_ = this,
                $el = this.$element,
                children = $el.children(this.options.childrenSelector);

            children.each(function invalidateChild() {
                var $child = $(this),
                    data = $child.data();

                if ($.isNumeric(data.dbTop) && $.isNumeric(data.dbLeft) &&
                        $.isNumeric(data.dbWidth) && $.isNumeric(data.dbHeight)) {
                    this_.makeBlock(data, this);
                }
            });

            return this;
        },
        makeBlock: function makeBlock(block, element) {
            var po = this.options,
                cell = {width: this._cellWidth, height: this._cellHeight},
                gutter = {width: this._gutterWidth, height: this._gutterHeight},
                grid = {cols: this._numCols, rows: this._numRows},
                opts = {
                    editable: po.editor,
                    evtPrefix: this.evtPrefix,
                    blockElement: po.childElement,
                    btnClass: po.btnClass,
                    primaryBtnClass: po.primaryBtnClass,
                    iconStretchV: po.iconStretchV,
                    iconStretchH: po.iconStretchH,
                    iconStretchF: po.iconStretchF,
                    iconDelete: po.iconDelete
                },
                block;

            $.extend(opts, {cell: cell, gutter: gutter, grid: grid}, block);

            block = new Block(element, opts);

            this.children.push(block);

            if (element === undefined) {
                this.$element.append(block.el);
            }
            block.$el.trigger('block:created.dashboard', block.toJSON());
        },
        _onBlockRemove: function onBlockRemove(blockCid) {
            var filtered,
                block;
            filtered = $.grep(this.children, function filterChildren(child) {
                var r = child.cid && child.cid !== blockCid;
                if (!r) {
                    block = child;
                }
                return r;
            });
            if (block) {
                block.$el.trigger('block:removed.dashboard', block.toJSON());
                block.destroy();
                this.children = filtered;
            }
        },
        _onBlockChanged: function onBlockChanged(block) {
            block.$el.trigger('block:changed.dashboard', block.toJSON());
        },
        toggleEditor: function toggleGrid() {
            this.options.editor = !this.options.editor;
            if (this.options.editor) {
                this._makeGrid();
                this._setBlocksEditable();
            } else {
                this._unsetBlocksEditable();
                this._removeGrid();
            }
            return this;
        },
        toJSON: function toJSON() {
            var jsoned = [];
            $.each(this.children, function getJsoned(idx, block) {
                jsoned.push(block.toJSON());
            });
            return jsoned;
        },
        clear: function cleanDashboard() {
            if (!this.options.editor) {
                return this;
            }
            $.each(this.children, function iterChildren(k, block) {
                block.$el.trigger('dashboard:remove');
                block.destroy();
            });
            this.children = [];
            return this;
        }
    };

    /***
     * dashboard plugin definfition
     *
     ***/
    $.fn[pluginName] = function (options) {
        var args = arguments;

        if (options === undefined || typeof options === 'object') {
            return this.each(function mkPlugin() {

                if (!$.data(this, dataPlugin)) {
                    $.data(this, dataPlugin, new Plugin(this, options));
                }
            });

        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {

            var returns = [];

            this.each(function makeCall() {
                var instance = $.data(this, dataPlugin),
                    result;

                if (instance instanceof Plugin && typeof instance[options] === 'function') {

                    result = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }

                returns.push(result);

            });

            return returns.length === 0 ? this : (returns.length === 1 ? returns[0] : returns);
        }
    };


    // FIXME required to use visual block builder
    $.drop({multi: true});

}(jQuery, window, document));
