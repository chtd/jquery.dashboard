/*
 *  Project: jquery.dashboard.js
 *  Description: jQuery dashboard
 *  Author: Chtd LLC.
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
        states = {
            free: 0,
            selected: 1,
            occupied: 2
        },
        defaults = {
            grid: [20, 15],
            gutter: [5, 5]
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

            el.classList.add('db-grid-cell');
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
            this.el.classList.add('db-grid-cell-selected');
            this.setState(states.selected);
        },
        onDropEnd: function onDropEnd(ev, dd) {
            this.el.classList.remove('db-grid-cell-selected');
        },
        onDrop: function onDrop(ev, dd) {
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

            el.classList.add('db-grid');
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
            $(dd.proxy).remove();
            console.log(this.getSelected());
        },
        onDrag: function onDrag(ev, dd) {
            $(dd.proxy).css({
                top: Math.min(ev.pageY, dd.startY),
                left: Math.min(ev.pageX, dd.startX),
                height: Math.abs(ev.pageY - dd.startY),
                width: Math.abs(ev.pageX - dd.startX)
            });
        }
    });


    // The actual plugin constructor
    function Plugin(element, options) {

        this.element = element;
        this.$element = $(element);
        this.options = $.extend({}, defaults, options);

        this._defaults = defaults;
        this._name = pluginName;
        this._children = {};

        this.init();
    }

    Plugin.prototype = {
        _calcDimensions: function calcDimensions() {
            var $el = this.$element,
                grid = this.options.grid,
                width = $el.width(),
                height = $el.height(),
                top_ = parseInt($el.css('padding-top'), 10),
                left_ = parseInt($el.css('padding-left'), 10),
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

            this._blockWidth = blockWidth;
            this._blockHeight = blockHeight;

            return this;
        },
        _makeGrid: function makeGrid() {
            var opts = {
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

            this.initialize();
            this.invalidate();

            $.drop({multi: true});
        },
        destroy: function destroyPlugin() {
            var el = this.element,
                children = this._children;
            this.$element.data(dataPlugin, null);
            this.element = null;
            this.options = null;
            this._defaults = null;
            this._children = null;

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
