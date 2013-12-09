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

    // Create the defaults once
    var pluginName = 'dashboard',
        dataPlugin = 'plugin_' + pluginName,
        dataChild = 'child_' + pluginName,
        cid = 0,
        zIndex = 0,
        states = {
            free: 0,
            selected: 1,
            occupied: 2
        },
        defaults = {
            showGrid: false,
            grid: [20, 15],
            gutter: [10, 10]
        };

    function getNextCid() {
        return 'cn' + cid++;
    }


    function Cell(options) {
        this.column = options.col;
        this.row = options.row;
        this.width = options.width;
        this.height = options.height;

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
            // TODO
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

            this.$el.drop('start', function callOnDropStart(ev, dd){
                return this_.onDropStart.apply(this_, arguments);
            })
            .drop('end', function callOnDropEnd(ev, dd){
                this_.onDropEnd.apply(this_, arguments);
            })
            .drop(function( ev, dd ){
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
        this._numCols = options.numCols;
        this._numRows = options.numRows;
        this._blockWidth = options.blockWidth;
        this._blockHeight = options.blockHeight;
        this._width = options.numCols * options.blockWidth;
        this._height = options.numRows * options.blockHeight;
        this._top = options.top_;
        this._left = options.left;
        this._showGrid = options.showGrid;

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
            if (this._showGrid) {
                el.className += ' db-grid-bordered';
            }
            el.style.top = this._top + 'px';
            el.style.left = this._left + 'px';
            el.style.width = this._width + 'px';
            el.style.height = this._height + 'px';

            for (i=0; i<this._numRows; i++) {
                for (j=0; j<this._numCols; j++) {
                    opts = {
                        col: j,
                        row: i,
                        width: this._blockWidth,
                        height: this._blockHeight
                    };
                    cell = new Cell(opts);
                    this.children.push(cell);
                    this._childrenByCid[cell.cid] = cell;
                }
            }

            this.attachDragEvents();
        },
        destroy: function destroy() {
            // TODO
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
            var top_,
                left,
                bottom,
                right,
                evt = new $.Event('makeblock.dashboard');

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
                top_: top_,
                left: left,
                bottom: bottom,
                right: right
            };
            this.$el.trigger(evt);
        },
        attachDragEvents: function attachDragEvents() {
            var this_ = this;

            this.$el.drag('start', function callOnDragStart(ev, dd) {
                return this_.onDragStart.apply(this_, arguments);
            })
            .drag('end', function callOnDragEnd(ev, dd){
                this_.onDragEnd.apply(this_, arguments);
            })
            .drag(function callOnDrag(ev, dd){
                this_.onDrag.apply(this_, arguments);
            });
        },
        onDragStart: function onDragStart(ev, dd) {
            return $('<div class="db-grid-selection" />').appendTo(document.body);
        },
        onDragEnd: function onDragEnd(ev, dd) {
            var cells = this.getSelected();
            this.makeBlock(cells);
            //this.setOccupied(cells);
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
    function Block(options) {
        this.top_ = options.top_;
        this.left = options.left;
        this.bottom = options.bottom;
        this.right = options.right;

        this.blockWidth = options.block.width;
        this.blockHeight = options.block.height;

        this.gutterWidth = options.gutter.width;
        this.gutterHeight = options.gutter.height;

        this.offsetTop = options.offset.top_;
        this.offsetLeft = options.offset.left;

        this.parentOffsetTop = options.offset.parentTop;
        this.parentOffsetLeft = options.offset.parentLeft;

        this.numCols = options.grid.cols;
        this.numRows = options.grid.rows;

        this.init();
    }

    $.extend(Block.prototype, {
        init: function initBlock() {
            var el = document.createElement('div'),
                bw = this.blockWidth,
                bh = this.blockHeight,
                gw = this.gutterWidth,
                gh = this.gutterHeight,
                top_ = (bh * this.top_) + parseInt(gh / 2, 10) + this.offsetTop,
                left = (bw * this.left) + parseInt(gw / 2, 10) + this.offsetLeft,
                width = bw * (this.right - this.left + 1) - gw,
                height = bh * (this.bottom - this.top_ + 1) - gh;

            this.cid = getNextCid();
            this._resizeHandlers = [];

            this.el = el;
            this.$el = $(el);

            this.el.className += ' db-block';

            this.el.style.top = top_ + 'px';
            this.el.style.left = left + 'px';
            this.el.style.width = width + 'px';
            this.el.style.height = height + 'px';
            this.el.style.zIndex = zIndex++;

            this._elPos = {
                width: width,
                height: height,
                top: top_,
                left: left
            };

            this.attachHandlers();
        },
        attachHandlers: function attachHandlers() {
            var this_ = this;
            this.$el.
                on('mouseenter', function callOnMouseEnter() {
                    this_.onMouseEnter.apply(this_, arguments);
                }).
                on('mouseleave', function callOnMouseLeave() {
                    this_.onMouseLeave.apply(this_, arguments);
                });

            this.$el.drag('start', function callOnDragStart() {
                    return this_.onDragStart.apply(this_, arguments);
                }, {drop: false, relative: true}).
                drag(function callOnDrag() {
                    this_.onDrag.apply(this_, arguments);
                });
            return this;
        },
        detachHandlers: function detachHandlers() {
            this.$el.off();
            return this;
        },
        onMouseEnter: function onMouseEnter(event) {
            this.makeResizeHandlers();
        },
        onMouseLeave: function onMouseLeave(event) {
            this.removeResizeHandlers();
        },
        getLimits: function getLimits() {
            return {
                top: this.offsetTop,
                left: this.offsetLeft,
                bottom: this.offsetTop + this.numRows * this.blockHeight - this.$el.outerHeight(),
                right: this.offsetLeft + this.numCols * this.blockWidth - this.$el.outerWidth()
            };
        },
        onDragStart: function onDragStart(ev, dd) {
            this.el.style.zIndex = zIndex++;

            dd.limit = this.getLimits();
            dd.isBlock = true;
        },
        onDrag: function onDrag(ev, dd) {
            var props = {
                top: Math.round(Math.min(dd.limit.bottom, Math.max(dd.limit.top, dd.offsetY)) / this.blockHeight) * this.blockHeight + this.gutterHeight,
                left: Math.round(Math.min(dd.limit.right, Math.max(dd.limit.left, dd.offsetX)) / this.blockWidth) * this.blockWidth + this.gutterWidth
            };
            this.$el.css(props);
            this._elPos.top = props.top;
            this._elPos.left = props.left;
        },
        makeResizeHandlers: function makeResizeHandlers() {
            var rh = this._resizeHandlers,
                frag = document.createDocumentFragment(),
                handlers = ['w', 'e', 'n', 's', 'nw', 'ne', 'sw', 'se'],
                div;

            $.each(handlers, function mkHandler(k, place) {
                div = document.createElement('div');
                div.className += ' db-block-resizer';
                div.className += ' db-block-resizer-' + place;
                div.setAttribute('data-direction', place);
                rh.push(div);
                frag.appendChild(div);
            });
            this.el.appendChild(frag);

            this.attachResizeHandlersEvents();

            return this;
        },
        removeResizeHandlers: function removeResizeHandlers() {
            $.each(this._resizeHandlers, function rmHandler(k, div) {
                div.remove();
            });
            this._resizeHandlers = [];
        },
        attachResizeHandlersEvents: function attachResizeHandler() {
            var this_ = this;
            this.$el.find('.db-block-resizer').drag('start', function callOnResizeStart() {
                return this_.onResizeStart.apply(this_, arguments);
            }, {drop: false}).
            drag('end', function callOnDragEnd() {
                this_.onResizeEnd.apply(this_, arguments);
            }).
            drag(function callOnResize() {
                this_.onResize.apply(this_, arguments);
            });
        },
        onResizeStart: function onResizeStart(ev, dd) {
            var target = ev.target,
                direction = target.getAttribute('data-direction');

            dd.resizeDirection = direction;
        },
        onResize: function onResize(ev, dd) {
            var direction = dd.resizeDirection,
                minWidth = this.blockWidth - this.gutterWidth,
                minHeight = this.blockHeight - this.gutterHeight,
                originalWidth = this._elPos.width,
                originalHeight = this._elPos.height,
                left = this._elPos.left,
                top_ = this._elPos.top,
                props = {},
                limits = this.getLimits(),
                blocksX = Math.round(dd.deltaX / this.blockWidth) * this.blockWidth,
                blocksY = Math.round(dd.deltaY / this.blockHeight) * this.blockHeight;

            if (direction.indexOf('e') > -1){
                props.width = Math.max(minWidth, originalWidth + blocksX);
            }
            if (direction.indexOf('s') > -1){
                props.height = Math.max(minHeight, originalHeight + blocksY);
            }
            if (direction.indexOf('w') > -1){
                props.width = Math.max(minWidth, originalWidth - blocksX);
                props.left = left + originalWidth - props.width;
                if (props.left < limits.left) {
                    props.left = limits.left;
                }
            }
            if (direction.indexOf('n') > -1){
                props.height = Math.max(minHeight, originalHeight - blocksY);
                props.top = top_ + originalHeight - props.height;
                if (props.top < limits.top) {
                    props.top = limits.top;
                }
            }
            this.$el.css(props);
        },
        onResizeEnd: function onResizeEnd(ev, dd) {
            var $el = this.$el,
                w = $el.width(),
                h = $el.height(),
                pos = $el.position();

            this._elPos = {
                left: pos.left,
                top: pos.top,
                width: w,
                height: h
            };
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
                grid = this.options.grid,
                gutter = this.options.gutter,
                width = $el.width(),
                height = $el.height(),
                top_ = parseInt($el.css('padding-top'), 10),
                left_ = parseInt($el.css('padding-left'), 10),
                offset = $el.offset(),
                numCols = grid[0],
                numRows = grid[1],
                blockWidth = parseInt(width / numCols, 10),
                blockHeight = parseInt(height / numRows, 10);

            if (blockWidth < 10) {
                $.error('Calculated block width is too small! Please decrease number of blocks in a row.');
            }
            if (blockHeight < 10) {
                $.error('Calculated block height is too small! Please decrease number of blocks in a column.');
            }

            this._numCols = numCols;
            this._numRows = numRows;

            this._width = width;
            this._height = height;
            this._top = top_;
            this._left = left_;
            this._offset = offset;

            this._blockWidth = blockWidth;
            this._blockHeight = blockHeight;

            this._gutterWidth = gutter[0];
            this._gutterHeight = gutter[1];

            return this;
        },
        _makeGrid: function makeGrid() {
            var opts = {
                showGrid: this.options.showGrid,
                numCols: this._numCols,
                numRows: this._numRows,
                blockWidth: this._blockWidth,
                blockHeight: this._blockHeight,
                top_: this._top,
                left: this._left
            };

            this._grid = new Grid(opts);
            this.$element.prepend(this._grid.render().el);

            return this;
        },
        _attachHandlers: function attachHandlers() {
            var this_ = this;
            this._grid.$el.on('makeblock.dashboard', function callMakeBlock() {
                this_.makeBlock.apply(this_, arguments);
            });
        },
        init: function initPlugin() {
            // Place initialization logic here
            // You already have access to the DOM element and the options via the instance,
            // e.g., this.element and this.options
            var opts = this.options,
                grid = opts.grid,
                gutter = opts.gutter;

            if (!$.isArray(grid) || grid.length !== 2) {
                $.error('options.grid must be an Array of 2 elements!');
            }
            if (!$.isArray(gutter) || gutter.length !== 2) {
                $.error('options.gutter must be an Array of 2 elements!');
            }

            this.children = [];

            this.initialize();
            this.invalidate();

            $.drop({multi: true});
        },
        destroy: function destroyPlugin() {
            var el = this.element,
                children = this.children;

            this._grid.destroy();
            this.$element.data(dataPlugin, null);
            this.element = null;
            this.options = null;
            this._defaults = null;
            this._children = null;
            this._grid = null;

            $.each(children, function iterChildren(k, v) {
                v.child.data(dataChild, null);
                v.child = null;
                children[k] = null;
            });
            return el;
        },
        initialize: function initializePlugin() {

            this._calcDimensions();
            this._makeGrid();
            this._attachHandlers();

            return this;
        },
        invalidate: function invalidatePlugin() {
            var this_ = this,
                $el = this.$element,
                children = $el.children();

            children.each(function invalidateChild() {
                var $child = $(this),
                    data = $child.data(dataChild),
                    cid,
                    hash;

                if (data === undefined) {
                    cid = getNextCid();
                    this_[cid] = {child: $child};
                    $child.data(dataChild, cid);
                }
            });

            return this;
        },
        makeBlock: function makeBlock(event) {
            var block = {width: this._blockWidth, height: this._blockHeight},
                gutter = {width: this._gutterWidth, height: this._gutterHeight},
                offset = {top_: this._top, left: this._left, parentTop: this._offset.top, parentLeft: this._offset.left},
                grid = {cols: this._numCols, rows: this._numRows},
                opts = $.extend({}, {block: block, gutter: gutter, offset: offset, grid: grid}, event.block),
                instance;

            instance = new Block(opts);

            this.children.push(instance);
            this.$element.append(instance.el);
        },
        toggleGrid: function toggleGrid() {
            this._grid.toggleGrid();
            return this;
        },
        clear: function cleanDashboard() {
            $.each(this.children, function iterChildren(k, v) {
                v.destroy();
            });
            this._grid.clearGrid();
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
