/*
 *  Project: jquery.dashboard.js
 *  Description: jQuery dashboard
 *  Author: Yuri Egorov <yuri.egorov@chtd.ru>
 *  Copyright: Chtd LLC.
 *  License: MIT (?)
 */


// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ($, window, document, undefined) {

    'use strict';

    // undefined is used here as the undefined global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). undefined isn't really being
    // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
    // can no longer be modified.

    // window is passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    var pluginName = 'dashboard',
        dataPlugin = 'plugin_' + pluginName,
        dataChild = 'child_' + pluginName,
        makeBlockEvent = 'makeblock.dashboard',
        changeBlockEvent = 'changeblock.dashboard',
        cid = 0,
        zIndex = 0,
        states = {
            free: 0,
            selected: 1,
            occupied: 2
        },
        defaults = {
            editor: false,
            grid: [20, 15],
            gutter: [10, 10]
        };

    function getNextCid() {
        return 'cn' + cid++;
    }


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


    // Grid container
    function Grid(options) {
        var cell = options.cell,
            size = options.size;

        this._numCols = size[0];  // number of columns
        this._numRows = size[1];  // number of rows
        this._cellWidth = cell[0];  // cell width
        this._cellHeight = cell[1];  // cell height
        this._width = this._numCols * this._cellWidth;  // grid full width
        this._height = this._numRows * this._cellHeight;  // grid full height

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
            var evt = new $.Event(makeBlockEvent),
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

            evt.block = {
                dbTop: top_,
                dbLeft: left,
                dbWidth: right - left + 1,
                dbHeight: bottom - top_ + 1
            };
            this.$el.trigger(evt);
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


    // Dashboard block
    function Block(element, options) {
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

        this.el = element || document.createElement('div');

        this.editable = options.editable || false;

        this.init();
    }

    $.extend(Block.prototype, {
        init: function initBlock() {
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

            this.$el = $(el);

            this.cid = getNextCid();
            this._resizeHandlers = [];

            this.el.className += ' db-block';

            this.el.style.top = top_ + 'px';
            this.el.style.left = left + 'px';
            this.el.style.width = width + 'px';
            this.el.style.height = height + 'px';
            this.el.style.zIndex = zIndex++;

            if (this.editable) {
                this.attachHandlers();
            }
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
            this.removeMoveResizeHandlers();
            return this;
        },
        onMouseEnter: function onMouseEnter(event) {
            this.makeMoveResizeHandlers();
        },
        onMouseLeave: function onMouseLeave(event) {
            if (!this._moveResizePending) {
                this.removeMoveResizeHandlers();
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
        onDragStart: function onDragStart(ev, dd) {
            this._moveResizePending = true;
            this.el.style.zIndex = zIndex++;

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
        },
        makeMoveResizeHandlers: function makeMoveResizeHandlers() {
            var rh = this._resizeHandlers,
                frag = document.createDocumentFragment(),
                mover = document.createElement('div'),
                handlers = ['w', 'e', 'n', 's', 'nw', 'ne', 'sw', 'se'];

            $.each(handlers, function mkHandler(k, place) {
                var div = document.createElement('div');

                div.className += ' db-block-resizer';
                div.className += ' db-block-resizer-' + place;
                div.setAttribute('data-direction', place);

                rh.push(div);
                frag.appendChild(div);
            });

            mover.className += ' db-block-mover';
            frag.appendChild(mover);
            rh.push(mover);

            this.el.appendChild(frag);

            this.attachResizeHandlersEvents();
            this.attachMoveHandlerEvents();

            return this;
        },
        removeMoveResizeHandlers: function removeMoveResizeHandlers() {
            var el = this.el;

            this.detachMoveHandlerEvents();
            this.detachResizeHandlersEvents();

            $.each(this._resizeHandlers, function rmHandler(k, div) {
                el.removeChild(div);
            });

            this._resizeHandlers = [];
            this._removeHandlersOnResize = false;
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
        onResizeStart: function onResizeStart(ev, dd) {
            var target = ev.target,
                direction = target.getAttribute('data-direction');

            this._moveResizePending = true;

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
        },
        setEditable: function setEditable() {
            this.editable = true;
            this.attachHandlers();
            return this;
        },
        unsetEditable: function unsetEditable() {
            this.editable = false;
            this.detachHandlers();
            return this;
        },
        destroy: function destroyBlock() {
            this.detachHandlers();
            this.$el.remove();
            this.$el = null;
            this.el = null;
        }
    });


    // The actual plugin constructor
    function Plugin(element, options) {

        this.element = element;
        this.$element = $(element);
        this.options = $.extend({}, defaults, options);

        this._defaults = defaults;
        this._name = pluginName;

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
                size: [this._numCols, this._numRows],
                cell: [this._cellWidth, this._cellHeight]
            };

            this.grid = new Grid(opts);
            this.$element.prepend(this.grid.render().el);

            return this;
        },
        _attachGridHandlers: function attachGridHandlers() {
            var this_ = this;

            if (this.grid) {
                this.grid.$el.on(makeBlockEvent, function callMakeBlock() {
                    this_.onMakeBlock.apply(this_, arguments);
                });
            }
            return this;
        },
        _detachGridHandlers: function detachGridHandlers() {
            if (this.grid) {
                this.grid.$el.off(makeBlockEvent);
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
        init: function initPlugin() {
            // Place initialization logic here
            // You already have access to the DOM element and the options via the instance,
            // e.g., this.element and this.options
            var opts = this.options,
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
                this._attachGridHandlers();
                this._setBlocksEditable();
            }

            this.invalidate();

            $.drop({multi: true});
        },
        destroy: function destroyPlugin() {
            var el = this.element,
                children = this.children;

            this.grid.destroy();
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
        invalidate: function invalidatePlugin() {
            var this_ = this,
                $el = this.$element,
                children = $el.children();

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
        onMakeBlock: function onMakeBlock(event) {
            this.makeBlock(event.block);
        },
        makeBlock: function makeBlock(block, element) {
            var cell = {width: this._cellWidth, height: this._cellHeight},
                gutter = {width: this._gutterWidth, height: this._gutterHeight},
                grid = {cols: this._numCols, rows: this._numRows},
                opts = $.extend({editable: this.options.editor},
                            {cell: cell, gutter: gutter, grid: grid}, block),
                instance;

            instance = new Block(element, opts);

            this.children.push(instance);

            if (element === undefined) {
                this.$element.append(instance.el);
            }
        },
        toggleEditor: function toggleGrid() {
            this.options.editor = !this.options.editor;
            if (this.options.editor) {
                this._makeGrid();
                this._attachGridHandlers();
                this._setBlocksEditable();
            } else {
                this._unsetBlocksEditable();
                this._detachGridHandlers();
                this.grid.destroy();
                this.grid = null;
            }
            return this;
        },
        clear: function cleanDashboard() {
            $.each(this.children, function iterChildren(k, v) {
                v.destroy();
            });
            this.children = [];
            return this;
        }
    };

    // You don't need to change something below:
    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations and allowing any
    // public function (ie. a function whose name doesn't start
    // with an underscore) to be called via the jQuery plugin,
    // e.g. $(element).dashboard('functionName', arg1, arg2)
    $.fn[pluginName] = function (options) {
        var args = arguments;

        // Is the first parameter an object (options), or was omitted,
        // instantiate a new instance of the plugin.
        if (options === undefined || typeof options === 'object') {
            return this.each(function mkPlugin() {

                // Only allow the plugin to be instantiated once,
                // so we check that the element has no plugin instantiation yet
                if (!$.data(this, dataPlugin)) {

                    // if it has no instance, create a new one,
                    // pass options to our plugin constructor,
                    // and store the plugin instance
                    // in the elements jQuery data object.
                    $.data(this, dataPlugin, new Plugin(this, options));
                }
            });

        // If the first parameter is a string and it doesn't start
        // with an underscore or "contains" the `init`-function,
        // treat this as a call to a public method.
        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {

            // Cache the method call
            // to make it possible
            // to return a value
            var returns = [];

            this.each(function makeCall() {
                var instance = $.data(this, dataPlugin),
                    result;

                // Tests that there's already a plugin-instance
                // and checks that the requested public method exists
                if (instance instanceof Plugin && typeof instance[options] === 'function') {

                    // Call the method of our plugin instance,
                    // and pass it the supplied arguments.
                    result = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }

                returns.push(result);

            });

            // If the earlier cached method
            // gives a value back return the value,
            // otherwise return this to preserve chainability.
            return returns.length === 0 ? this : (returns.length === 1 ? returns[0] : returns);
        }
    };

}(jQuery, window, document));
