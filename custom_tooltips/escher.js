(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.escher = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Behavior. Defines the set of click and drag behaviors for the map, and keeps
 * track of which behaviors are activated.
 *
 * A Behavior instance has the following attributes:
 *
 * my_behavior.rotation_drag, my_behavior.text_label_mousedown,
 * my_behavior.text_label_click, my_behavior.selectable_mousedown,
 * my_behavior.selectable_click, my_behavior.selectable_drag,
 * my_behavior.node_mouseover, my_behavior.node_mouseout,
 * my_behavior.label_mousedown, my_behavior.label_mouseover,
 * my_behavior.label_mouseout, my_behavior.bezier_drag,
 * my_behavior.bezier_mouseover, my_behavior.bezier_mouseout,
 * my_behavior.reaction_label_drag, my_behavior.node_label_drag,
 *
 */

/* global d3 */

var utils = require('./utils')
var build = require('./build')


var Behavior = utils.make_class()
// methods
Behavior.prototype = {
  init: init,
  toggle_rotation_mode: toggle_rotation_mode,
  turn_everything_on: turn_everything_on,
  turn_everything_off: turn_everything_off,
  // toggle
  toggle_selectable_click: toggle_selectable_click,
  toggle_text_label_edit: toggle_text_label_edit,
  toggle_selectable_drag: toggle_selectable_drag,
  toggle_label_drag: toggle_label_drag,
  toggle_label_mouseover: toggle_label_mouseover,
  toggle_bezier_drag: toggle_bezier_drag,
  // util
  turn_off_drag: turn_off_drag,
  // get drag behaviors
  _get_selectable_drag: _get_selectable_drag,
  _get_bezier_drag: _get_bezier_drag,
  _get_reaction_label_drag: _get_reaction_label_drag,
  _get_node_label_drag: _get_node_label_drag,
  _get_generic_drag: _get_generic_drag,
  _get_generic_angular_drag: _get_generic_angular_drag
}
module.exports = Behavior


// definitions
function init( map, undo_stack) {
  this.map = map
  this.undo_stack = undo_stack

  // make an empty function that can be called as a behavior and does nothing
  this.empty_behavior = function () {}

  // rotation mode operates separately from the rest
  this.rotation_mode_enabled = false
  this.rotation_drag = d3.behavior.drag()

  // behaviors to be applied
  this.selectable_mousedown = null
  this.text_label_mousedown = null
  this.text_label_click = null
  this.selectable_drag = this.empty_behavior
  this.node_mouseover = null
  this.node_mouseout = null
  this.label_mousedown = null
  this.label_mouseover = null
  this.label_mouseout = null
  this.bezier_drag = this.empty_behavior
  this.bezier_mouseover = null
  this.bezier_mouseout = null
  this.reaction_label_drag = this.empty_behavior
  this.node_label_drag = this.empty_behavior
  this.dragging = false
  this.turn_everything_on()
}

/**
 * Toggle everything except rotation mode and text mode.
 */
function turn_everything_on () {
  this.toggle_selectable_click(true)
  this.toggle_selectable_drag(true)
  this.toggle_label_drag(true)
  this.toggle_label_mouseover(true)
}

/**
 * Toggle everything except rotation mode and text mode.
 */
function turn_everything_off () {
  this.toggle_selectable_click(false)
  this.toggle_selectable_drag(false)
  this.toggle_label_drag(false)
  this.toggle_label_mouseover(false)
}

function toggle_rotation_mode (on_off) {
  /** Listen for rotation, and rotate selected nodes.

   */
  if (on_off === undefined) {
    this.rotation_mode_enabled = !this.rotation_mode_enabled
  } else {
    this.rotation_mode_enabled = on_off
  }

  var selection_node = this.map.sel.selectAll('.node-circle')
  var selection_background = this.map.sel.selectAll('#canvas')

  if (this.rotation_mode_enabled) {
    this.map.callback_manager.run('start_rotation')

    var selected_nodes = this.map.get_selected_nodes()
    if (Object.keys(selected_nodes).length === 0) {
      console.warn('No selected nodes')
      return
    }

    // show center
    this.center = average_location(selected_nodes)
    show_center.call(this)

    // this.set_status('Drag to rotate.')
    var map = this.map
    var selected_node_ids = Object.keys(selected_nodes)
    var reactions = this.map.reactions
    var nodes = this.map.nodes
    var beziers = this.map.beziers

    var start_fn = function (d) {
      // silence other listeners
      d3.event.sourceEvent.stopPropagation()
    }
    var drag_fn = function (d, angle, total_angle, center) {
      var updated = build.rotate_nodes(selected_nodes, reactions,
                                       beziers, angle, center)
      map.draw_these_nodes(updated.node_ids)
      map.draw_these_reactions(updated.reaction_ids)
    }
    var end_fn = function (d) {}
    var undo_fn = function (d, total_angle, center) {
      // undo
      var these_nodes = {}
      selected_node_ids.forEach(function (id) {
        these_nodes[id] = nodes[id]
      })
      var updated = build.rotate_nodes(these_nodes, reactions,
                                       beziers, -total_angle,
                                       center)
      map.draw_these_nodes(updated.node_ids)
      map.draw_these_reactions(updated.reaction_ids)
    }
    var redo_fn = function (d, total_angle, center) {
      // redo
      var these_nodes = {}
      selected_node_ids.forEach(function (id) {
        these_nodes[id] = nodes[id]
      })
      var updated = build.rotate_nodes(these_nodes, reactions,
                                       beziers, total_angle,
                                       center)
      map.draw_these_nodes(updated.node_ids)
      map.draw_these_reactions(updated.reaction_ids) }
    var center_fn = function () {
      return this.center
    }.bind(this)
    this.rotation_drag = this._get_generic_angular_drag(start_fn, drag_fn,
                                                        end_fn, undo_fn,
                                                        redo_fn, center_fn,
                                                        this.map.sel)
    selection_background.call(this.rotation_drag)
    this.selectable_drag = this.rotation_drag
  } else {
    // turn off all listeners
    hide_center.call(this)
    selection_node.on('mousedown.center', null)
    selection_background.on('mousedown.center', null)
    selection_background.on('mousedown.drag', null)
    selection_background.on('touchstart.drag', null)
    this.rotation_drag = null
    this.selectable_drag = null
  }

  // definitions
  function show_center() {
    var s = this.map.sel.selectAll('#rotation-center').data([0])
    var enter = s.enter().append('g').attr('id', 'rotation-center')

    enter.append('path').attr('d', 'M-32 0 L32 0')
      .attr('class', 'rotation-center-line')
    enter.append('path').attr('d', 'M0 -32 L0 32')
      .attr('class', 'rotation-center-line')

    s.attr('transform', 'translate('+this.center.x+','+this.center.y+')')
      .attr('visibility', 'visible')

    s.call(d3.behavior.drag()
           .on('drag', function (sel) {
             var cur = utils.d3_transform_catch(sel.attr('transform')),
             new_loc = [d3.event.dx + cur.translate[0],
                        d3.event.dy + cur.translate[1]]
             sel.attr('transform', 'translate('+new_loc+')')
             this.center = { x: new_loc[0], y: new_loc[1] }
           }.bind(this, s)))
    s.on('mouseover', function () {
      var current = parseFloat(this.selectAll('path').style('stroke-width'))
      this.selectAll('path').style('stroke-width', current * 2 + 'px')
    }.bind(s))
    s.on('mouseout', function () {
      this.selectAll('path').style('stroke-width', null)
    }.bind(s))
  }
  function hide_center(sel) {
    this.map.sel.select('#rotation-center')
      .attr('visibility', 'hidden')
  }
  function average_location(nodes) {
    var xs = []
    var ys = []
    for (var node_id in nodes) {
      var node = nodes[node_id]
      if (node.x !== undefined)
        xs.push(node.x)
      if (node.y !== undefined)
        ys.push(node.y)
    }
    return { x: utils.mean(xs),
             y: utils.mean(ys) }
  }
}

/**
 * With no argument, toggle the node click on or off. Pass in a boolean argument
 * to set the on/off state.
 */
function toggle_selectable_click (on_off) {
  if (on_off === undefined) {
    on_off = this.selectable_mousedown === null
  }
  if (on_off) {
    var map = this.map
    this.selectable_mousedown = function (d) {
      // stop propogation for the buildinput to work right
      d3.event.stopPropagation()
      // this.parentNode.__data__.was_selected = d3.select(this.parentNode).classed('selected')
      // d3.select(this.parentNode).classed('selected', true)
    }
    this.selectable_click = function (d) {
      // stop propogation for the buildinput to work right
      d3.event.stopPropagation()
      // click suppressed. This DOES have en effect.
      if (d3.event.defaultPrevented) return
      // turn off the temporary selection so select_selectable
      // works. This is a bit of a hack.
      // if (!this.parentNode.__data__.was_selected)
      //     d3.select(this.parentNode).classed('selected', false)
      map.select_selectable(this, d, d3.event.shiftKey)
      // this.parentNode.__data__.was_selected = false
    }
    this.node_mouseover = function (d) {
      d3.select(this).style('stroke-width', null)
      var current = parseFloat(d3.select(this).style('stroke-width'))
      if (!d3.select(this.parentNode).classed('selected'))
        d3.select(this).style('stroke-width', current * 3 + 'px')
    }
    this.node_mouseout = function (d) {
      d3.select(this).style('stroke-width', null)
    }
  } else {
    this.selectable_mousedown = null
    this.selectable_click = null
    this.node_mouseover = null
    this.node_mouseout = null
    this.map.sel.select('#nodes')
      .selectAll('.node-circle').style('stroke-width', null)
  }
}

/**
 * With no argument, toggle the text edit on mousedown on/off. Pass in a boolean
 * argument to set the on/off state. The backup state is equal to
 * selectable_mousedown.
 */
function toggle_text_label_edit (on_off) {
  if (on_off === undefined) {
    on_off = this.text_edit_mousedown == null
  }
  if (on_off) {
    var map = this.map
    var selection = this.selection
    this.text_label_mousedown = function () {
      if (d3.event.defaultPrevented) {
        return // mousedown suppressed
      }
      // run the callback
      var coords_a = utils.d3_transform_catch(d3.select(this).attr('transform'))
          .translate
      var coords = { x: coords_a[0], y: coords_a[1] }
      map.callback_manager.run('edit_text_label', null, d3.select(this), coords)
      d3.event.stopPropagation()
    }
    this.text_label_click = null
    this.map.sel.select('#text-labels')
      .selectAll('.label')
      .classed('edit-text-cursor', true)
    // add the new-label listener
    this.map.sel.on('mousedown.new_text_label', function (node) {
      // silence other listeners
      d3.event.preventDefault()
      var coords = {
        x: d3.mouse(node)[0],
        y: d3.mouse(node)[1],
      }
      this.map.callback_manager.run('new_text_label', null, coords)
    }.bind(this, this.map.sel.node()))
  } else {
    this.text_label_mousedown = this.selectable_mousedown
    this.text_label_click = this.selectable_click
    this.map.sel.select('#text-labels')
      .selectAll('.label')
      .classed('edit-text-cursor', false)
    // remove the new-label listener
    this.map.sel.on('mousedown.new_text_label', null)
    this.map.callback_manager.run('hide_text_label_editor')
  }
}

/**
 * With no argument, toggle the node drag & bezier drag on or off. Pass in a
 * boolean argument to set the on/off state.
 */
function toggle_selectable_drag (on_off) {
  if (on_off === undefined) {
    on_off = this.selectable_drag === this.empty_behavior
  }
  if (on_off) {
    this.selectable_drag = this._get_selectable_drag(this.map, this.undo_stack)
    this.bezier_drag = this._get_bezier_drag(this.map, this.undo_stack)
  } else {
    this.selectable_drag = this.empty_behavior
    this.bezier_drag = this.empty_behavior
  }
}

/**
 * With no argument, toggle the label drag on or off. Pass in a boolean argument
 * to set the on/off state.
 * @param {Boolean} on_off - The new on/off state.
 */
function toggle_label_drag (on_off) {
  if (on_off === undefined) {
    on_off = this.label_drag === this.empty_behavior
  }
  if (on_off) {
    this.reaction_label_drag = this._get_reaction_label_drag(this.map)
    this.node_label_drag = this._get_node_label_drag(this.map)
  } else {
    this.reaction_label_drag = this.empty_behavior
    this.node_label_drag = this.empty_behavior
  }
}

/**
 * With no argument, toggle the tooltips on mouseover labels.
 * @param {Boolean} on_off - The new on/off state.
 */
function toggle_label_mouseover (on_off) {
  if (on_off === undefined) {
    on_off = this.label_mouseover === null
  }

  if (on_off) {

    // Show/hide tooltip.
    // @param {String} type - 'reaction_label' or 'node_label'
    // @param {Object} d - D3 data for DOM element
    this.label_mouseover = function (type, d) {
      if (!this.dragging) {
        this.map.callback_manager.run('show_tooltip', null, type, d)
      }
    }.bind(this)

    this.label_mouseout = function () {
      this.map.callback_manager.run('delay_hide_tooltip')
    }.bind(this)

  } else {
    this.label_mouseover = null
  }
}

/**
 * With no argument, toggle the bezier drag on or off. Pass in a boolean
 * argument to set the on/off state.
 */
function toggle_bezier_drag (on_off) {
  if (on_off === undefined) {
    on_off = this.bezier_drag === this.empty_behavior
  }
  if (on_off) {
    this.bezier_drag = this._get_bezier_drag(this.map)
    this.bezier_mouseover = function (d) {
      d3.select(this).style('stroke-width', String(3)+'px')
    }
    this.bezier_mouseout = function (d) {
      d3.select(this).style('stroke-width', String(1)+'px')
    }
  } else {
    this.bezier_drag = this.empty_behavior
    this.bezier_mouseover = null
    this.bezier_mouseout = null
  }
}

function turn_off_drag (sel) {
  sel.on('mousedown.drag', null)
  sel.on('touchstart.drag', null)
}

/**
 * Drag the selected nodes and text labels.
 */
function _get_selectable_drag (map, undo_stack) {

  // define some variables
  var behavior = d3.behavior.drag()
  var the_timeout = null
  var total_displacement = null
  // for nodes
  var node_ids_to_drag = null
  var reaction_ids = null
  // for text labels
  var text_label_ids_to_drag = null
  var move_label = function (text_label_id, displacement) {
    var text_label = map.text_labels[text_label_id]
    text_label.x = text_label.x + displacement.x
    text_label.y = text_label.y + displacement.y
  }
  var set_dragging = function (on_off) {
    this.dragging = on_off
  }.bind(this)

  behavior.on('dragstart', function (d) {
    set_dragging(true)

    // silence other listeners (e.g. nodes BELOW this one)
    d3.event.sourceEvent.stopPropagation()
    // remember the total displacement for later
    total_displacement = { x: 0, y: 0 }

    // If a text label is selected, the rest is not necessary
    if (d3.select(this).attr('class').indexOf('label') === -1) {
      // Note that dragstart is called even for a click event
      var data = this.parentNode.__data__,
      bigg_id = data.bigg_id,
      node_group = this.parentNode
      // Move element to back (for the next step to work). Wait 200ms
      // before making the move, becuase otherwise the element will be
      // deleted before the click event gets called, and selection
      // will stop working.
      the_timeout = setTimeout(function () {
        node_group.parentNode.insertBefore(node_group,
                                           node_group.parentNode.firstChild)
      }, 200)
      // prepare to combine metabolites
      map.sel.selectAll('.metabolite-circle')
        .on('mouseover.combine', function (d) {
          if (d.bigg_id === bigg_id && d.node_id !== data.node_id) {
            d3.select(this).style('stroke-width', String(12) + 'px')
              .classed('node-to-combine', true)
          }
        })
        .on('mouseout.combine', function (d) {
          if (d.bigg_id === bigg_id) {
            map.sel.selectAll('.node-to-combine')
              .style('stroke-width', String(2) + 'px')
              .classed('node-to-combine', false)
          }
        })
    }
  })

  behavior.on('drag', function (d) {
    // if this node is not already selected, then select this one and
    // deselect all other nodes. Otherwise, leave the selection alone.
    if (!d3.select(this.parentNode).classed('selected')) {
      map.select_selectable(this, d)
    }

    // get the grabbed id
    var grabbed = {}
    if (d3.select(this).attr('class').indexOf('label') === -1) {
      // if it is a node
      grabbed['type'] = 'node'
      grabbed['id'] = this.parentNode.__data__.node_id
    } else {
      // if it is a text label
      grabbed['type'] = 'label'
      grabbed['id'] = this.__data__.text_label_id
    }

    var selected_node_ids = map.get_selected_node_ids()
    var selected_text_label_ids = map.get_selected_text_label_ids()
    node_ids_to_drag = []; text_label_ids_to_drag = []
    // choose the nodes and text labels to drag
    if (grabbed['type']=='node' &&
        selected_node_ids.indexOf(grabbed['id']) === -1) {
      node_ids_to_drag.push(grabbed['id'])
    } else if (grabbed['type'] === 'label' &&
               selected_text_label_ids.indexOf(grabbed['id']) === -1) {
      text_label_ids_to_drag.push(grabbed['id'])
    } else {
      node_ids_to_drag = selected_node_ids
      text_label_ids_to_drag = selected_text_label_ids
    }
    reaction_ids = []
    var displacement = {
      x: d3.event.dx,
      y: d3.event.dy,
    }
    total_displacement = utils.c_plus_c(total_displacement, displacement)
    node_ids_to_drag.forEach(function (node_id) {
      // update data
      var node = map.nodes[node_id],
      updated = build.move_node_and_dependents(node, node_id,
                                               map.reactions,
                                               map.beziers,
                                               displacement)
      reaction_ids = utils.unique_concat([ reaction_ids, updated.reaction_ids ])
      // remember the displacements
      // if (!(node_id in total_displacement))  total_displacement[node_id] = { x: 0, y: 0 }
      // total_displacement[node_id] = utils.c_plus_c(total_displacement[node_id], displacement)
    })
    text_label_ids_to_drag.forEach(function (text_label_id) {
      move_label(text_label_id, displacement)
      // remember the displacements
      // if (!(node_id in total_displacement))  total_displacement[node_id] = { x: 0, y: 0 }
      // total_displacement[node_id] = utils.c_plus_c(total_displacement[node_id], displacement)
    })
    // draw
    map.draw_these_nodes(node_ids_to_drag)
    map.draw_these_reactions(reaction_ids)
    map.draw_these_text_labels(text_label_ids_to_drag)
  })

  behavior.on('dragend', function () {
    set_dragging(false)

    if (node_ids_to_drag === null) {
      // Dragend can be called when drag has not been called. In this,
      // case, do nothing.
      total_displacement = null
      node_ids_to_drag = null
      text_label_ids_to_drag = null
      reaction_ids = null
      the_timeout = null
      return
    }
    // look for mets to combine
    var node_to_combine_array = []
    map.sel.selectAll('.node-to-combine').each(function (d) {
      node_to_combine_array.push(d.node_id)
    })
    if (node_to_combine_array.length === 1) {
      // If a node is ready for it, combine nodes
      var fixed_node_id = node_to_combine_array[0],
      dragged_node_id = this.parentNode.__data__.node_id,
      saved_dragged_node = utils.clone(map.nodes[dragged_node_id]),
      segment_objs_moved_to_combine = combine_nodes_and_draw(fixed_node_id,
                                                             dragged_node_id)
      undo_stack.push(function () {
        // undo
        // put the old node back
        map.nodes[dragged_node_id] = saved_dragged_node
        var fixed_node = map.nodes[fixed_node_id],
            updated_reactions = []
        segment_objs_moved_to_combine.forEach(function (segment_obj) {
          var segment = map.reactions[segment_obj.reaction_id].segments[segment_obj.segment_id]
          if (segment.from_node_id==fixed_node_id) {
            segment.from_node_id = dragged_node_id
          } else if (segment.to_node_id==fixed_node_id) {
            segment.to_node_id = dragged_node_id
          } else {
            console.error('Segment does not connect to fixed node')
          }
          // removed this segment_obj from the fixed node
          fixed_node.connected_segments = fixed_node.connected_segments.filter(function (x) {
            return !(x.reaction_id==segment_obj.reaction_id && x.segment_id==segment_obj.segment_id)
          })
          if (updated_reactions.indexOf(segment_obj.reaction_id)==-1)
            updated_reactions.push(segment_obj.reaction_id)
        })
        map.draw_these_nodes([dragged_node_id])
        map.draw_these_reactions(updated_reactions)
      }, function () {
        // redo
        combine_nodes_and_draw(fixed_node_id, dragged_node_id)
      })

    } else {
      // otherwise, drag node

      // add to undo/redo stack
      // remember the displacement, dragged nodes, and reactions
      var saved_displacement = utils.clone(total_displacement),
      // BUG TODO this variable disappears!
      // Happens sometimes when you drag a node, then delete it, then undo twice
      saved_node_ids = utils.clone(node_ids_to_drag),
      saved_text_label_ids = utils.clone(text_label_ids_to_drag),
      saved_reaction_ids = utils.clone(reaction_ids)
      undo_stack.push(function () {
        // undo
        saved_node_ids.forEach(function (node_id) {
          var node = map.nodes[node_id]
          build.move_node_and_dependents(node, node_id, map.reactions,
                                         map.beziers,
                                         utils.c_times_scalar(saved_displacement, -1))
        })
        saved_text_label_ids.forEach(function (text_label_id) {
          move_label(text_label_id,
                     utils.c_times_scalar(saved_displacement, -1))
        })
        map.draw_these_nodes(saved_node_ids)
        map.draw_these_reactions(saved_reaction_ids)
        map.draw_these_text_labels(saved_text_label_ids)
      }, function () {
        // redo
        saved_node_ids.forEach(function (node_id) {
          var node = map.nodes[node_id]
          build.move_node_and_dependents(node, node_id, map.reactions,
                                         map.beziers,
                                         saved_displacement)
        })
        saved_text_label_ids.forEach(function (text_label_id) {
          move_label(text_label_id, saved_displacement)
        })
        map.draw_these_nodes(saved_node_ids)
        map.draw_these_reactions(saved_reaction_ids)
        map.draw_these_text_labels(saved_text_label_ids)
      })
    }

    // stop combining metabolites
    map.sel.selectAll('.metabolite-circle')
      .on('mouseover.combine', null)
      .on('mouseout.combine', null)

    // clear the timeout
    clearTimeout(the_timeout)

    // clear the shared variables
    total_displacement = null
    node_ids_to_drag = null
    text_label_ids_to_drag = null
    reaction_ids = null
    the_timeout = null
  })

  return behavior

  // definitions
  function combine_nodes_and_draw (fixed_node_id, dragged_node_id) {
    var dragged_node = map.nodes[dragged_node_id]
    var fixed_node = map.nodes[fixed_node_id]
    var updated_segment_objs = []
    dragged_node.connected_segments.forEach(function (segment_obj) {
      // change the segments to reflect
      var segment
      try {
        segment = map.reactions[segment_obj.reaction_id].segments[segment_obj.segment_id]
        if (segment === undefined) throw new Error('undefined segment')
      } catch (e) {
        console.warn('Could not find connected segment ' + segment_obj.segment_id)
        return
      }
      if (segment.from_node_id==dragged_node_id) segment.from_node_id = fixed_node_id
      else if (segment.to_node_id==dragged_node_id) segment.to_node_id = fixed_node_id
      else {
        console.error('Segment does not connect to dragged node')
        return
      }
      // moved segment_obj to fixed_node
      fixed_node.connected_segments.push(segment_obj)
      updated_segment_objs.push(utils.clone(segment_obj))
      return
    })
    // delete the old node
    map.delete_node_data([dragged_node_id])
    // turn off the class
    map.sel.selectAll('.node-to-combine').classed('node-to-combine', false)
    // draw
    map.draw_everything()
    // return for undo
    return updated_segment_objs
  }
}

function _get_bezier_drag (map) {
  var move_bezier = function (reaction_id, segment_id, bez, bezier_id,
                              displacement) {
    var segment = map.reactions[reaction_id].segments[segment_id]
    segment[bez] = utils.c_plus_c(segment[bez], displacement)
    map.beziers[bezier_id].x = segment[bez].x
    map.beziers[bezier_id].y = segment[bez].y
  }
  var start_fn = function (d) {
    d.dragging = true
  }
  var drag_fn = function (d, displacement, total_displacement) {
    // draw
    move_bezier(d.reaction_id, d.segment_id, d.bezier, d.bezier_id,
                displacement)
    map.draw_these_reactions([d.reaction_id], false)
    map.draw_these_beziers([d.bezier_id])
  }
  var end_fn = function (d) {
    d.dragging = false
  }
  var undo_fn = function (d, displacement) {
    move_bezier(d.reaction_id, d.segment_id, d.bezier, d.bezier_id,
                utils.c_times_scalar(displacement, -1))
    map.draw_these_reactions([d.reaction_id], false)
    map.draw_these_beziers([d.bezier_id])
  }
  var redo_fn = function (d, displacement) {
    move_bezier(d.reaction_id, d.segment_id, d.bezier, d.bezier_id,
                displacement)
    map.draw_these_reactions([d.reaction_id], false)
    map.draw_these_beziers([d.bezier_id])
  }
  return this._get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn,
                                this.map.sel)
}

function _get_reaction_label_drag (map) {
  var move_label = function (reaction_id, displacement) {
    var reaction = map.reactions[reaction_id]
    reaction.label_x = reaction.label_x + displacement.x
    reaction.label_y = reaction.label_y + displacement.y
  }
  var start_fn = function (d) {
    // hide tooltips when drag starts
    map.callback_manager.run('hide_tooltip')
  }
  var drag_fn = function (d, displacement, total_displacement) {
    // draw
    move_label(d.reaction_id, displacement)
    map.draw_these_reactions([ d.reaction_id ])
  }
  var end_fn = function (d) {
  }
  var undo_fn = function (d, displacement) {
    move_label(d.reaction_id, utils.c_times_scalar(displacement, -1))
    map.draw_these_reactions([ d.reaction_id ])
  }
  var redo_fn = function (d, displacement) {
    move_label(d.reaction_id, displacement)
    map.draw_these_reactions([ d.reaction_id ])
  }
  return this._get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn,
                                this.map.sel)
}

function _get_node_label_drag (map) {
  var move_label = function (node_id, displacement) {
    var node = map.nodes[node_id]
    node.label_x = node.label_x + displacement.x
    node.label_y = node.label_y + displacement.y
  }
  var start_fn = function (d) {
    // hide tooltips when drag starts
    map.callback_manager.run('hide_tooltip')
  }
  var drag_fn = function (d, displacement, total_displacement) {
    // draw
    move_label(d.node_id, displacement)
    map.draw_these_nodes([ d.node_id ])
  }
  var end_fn = function (d) {
  }
  var undo_fn = function (d, displacement) {
    move_label(d.node_id, utils.c_times_scalar(displacement, -1))
    map.draw_these_nodes ([ d.node_id ])
  }
  var redo_fn = function (d, displacement) {
    move_label(d.node_id, displacement)
    map.draw_these_nodes([ d.node_id ])
  }
  return this._get_generic_drag(start_fn, drag_fn, end_fn, undo_fn, redo_fn,
                                this.map.sel)
}

/**
 * Make a generic drag behavior, with undo/redo.
 *
 * start_fn: function (d) Called at dragstart.
 *
 * drag_fn: function (d, displacement, total_displacement) Called during drag.
 *
 * end_fn
 *
 * undo_fn
 *
 * redo_fn
 *
 * relative_to_selection: a d3 selection that the locations are calculated
 * against.
 *
 */
function _get_generic_drag (start_fn, drag_fn, end_fn, undo_fn, redo_fn,
                            relative_to_selection) {
  // define some variables
  var behavior = d3.behavior.drag()
  var total_displacement
  var undo_stack = this.undo_stack
  var rel = relative_to_selection.node()

  behavior.on('dragstart', function (d) {
    this.dragging = true

    // silence other listeners
    d3.event.sourceEvent.stopPropagation()
    total_displacement = { x: 0, y: 0 }
    start_fn(d)
  }.bind(this))

  behavior.on('drag', function (d) {
    // update data
    var displacement = {
      x: d3.event.dx,
      y: d3.event.dy,
    }
    var location = {
      x: d3.mouse(rel)[0],
      y: d3.mouse(rel)[1],
    }

    // remember the displacement
    total_displacement = utils.c_plus_c(total_displacement, displacement)
    drag_fn(d, displacement, total_displacement, location)
  }.bind(this))

  behavior.on('dragend', function (d) {
    this.dragging = false

    // add to undo/redo stack
    // remember the displacement, dragged nodes, and reactions
    var saved_d = utils.clone(d)
    var saved_displacement = utils.clone(total_displacement) // BUG TODO this variable disappears!
    var saved_location = {
      x: d3.mouse(rel)[0],
      y: d3.mouse(rel)[1],
    }

    undo_stack.push(function () {
      // undo
      undo_fn(saved_d, saved_displacement, saved_location)
    }, function () {
      // redo
      redo_fn(saved_d, saved_displacement, saved_location)
    })
    end_fn(d)
  }.bind(this))

  return behavior
}

/** Make a generic drag behavior, with undo/redo. Supplies angles in place of
 * displacements.
 *
 * start_fn: function (d) Called at dragstart.
 *
 * drag_fn: function (d, displacement, total_displacement) Called during drag.
 *
 * end_fn:
 *
 * undo_fn:
 *
 * redo_fn:
 *
 * get_center:
 *
 * relative_to_selection: a d3 selection that the locations are calculated
 * against.
 *
 */
function _get_generic_angular_drag (start_fn, drag_fn, end_fn, undo_fn, redo_fn,
                                   get_center, relative_to_selection) {

  // define some variables
  var behavior = d3.behavior.drag()
  var total_angle
  var undo_stack = this.undo_stack
  var rel = relative_to_selection.node()

  behavior.on('dragstart', function (d) {
    this.dragging = true

    // silence other listeners
    d3.event.sourceEvent.stopPropagation()
    total_angle = 0
    start_fn(d)
  }.bind(this))

  behavior.on('drag', function (d) {
    // update data
    var displacement = {
      x: d3.event.dx,
      y: d3.event.dy,
    }
    var location = {
      x: d3.mouse(rel)[0],
      y: d3.mouse(rel)[1],
    }
    var center = get_center()
    var angle = utils.angle_for_event(displacement, location, center)
    // remember the displacement
    total_angle = total_angle + angle
    drag_fn(d, angle, total_angle, center)
  }.bind(this))

  behavior.on('dragend', function (d) {
    this.dragging = false

    // add to undo/redo stack
    // remember the displacement, dragged nodes, and reactions
    var saved_d = utils.clone(d)
    var saved_angle = total_angle
    var saved_center = utils.clone(get_center())

    undo_stack.push(function () {
      // undo
      undo_fn(saved_d, saved_angle, saved_center)
    }, function () {
      // redo
      redo_fn(saved_d, saved_angle, saved_center)
    })
    end_fn(d)
  }.bind(this))

  return behavior
}

},{"./build":26,"./utils":33}],2:[function(require,module,exports){
/* global d3 */

var utils = require('./utils')

/**
 * Define a brush to select elements in a map.
 * @param {D3 Selection} selection - A d3 selection to place the brush in.
 * @param {Boolean} is_enabled - Whether to turn the brush on.
 * @param {escher.Map} map - The map where the brush will be active.
 * @param {String} insert_after - A d3 selector string to choose the svg element
 *                                that the brush will be inserted after. Often a
 *                                canvas element (e.g. '.canvas-group').
 */
var Brush = utils.make_class()
Brush.prototype = {
  init: init,
  toggle: toggle,
  setup_selection_brush: setup_selection_brush,
}
module.exports = Brush

// definitions
function init (selection, is_enabled, map, insert_after) {
  this.brush_sel = selection.append('g').attr('id', 'brush-container')
  var node = this.brush_sel.node()
  var insert_before_node = selection.select(insert_after).node().nextSibling
  if (node !== insert_before_node) {
    node.parentNode.insertBefore(node, insert_before_node)
  }
  this.enabled = is_enabled
  this.map = map
}

/**
 * Returns a boolean for the on/off status of the brush
 * @return {Boolean}
 */
function brush_is_enabled () {
  return this.map.sel.select('.brush').empty()
}

/**
 * Turn the brush on or off
 * @param {Boolean} on_off
 */
function toggle (on_off) {
  if (on_off === undefined) {
    on_off = !this.enabled
  }
  if (on_off) {
    this.selection_brush = this.setup_selection_brush()
  } else {
    this.brush_sel.selectAll('.brush').remove()
  }
}

function setup_selection_brush () {
  var map = this.map
  var selection = this.brush_sel
  var selectable_selection = map.sel.selectAll('#nodes,#text-labels')
  var size_and_location = map.canvas.size_and_location()
  var width = size_and_location.width
  var height = size_and_location.height
  var x = size_and_location.x
  var y = size_and_location.y

  // clear existing brush
  selection.selectAll('g').remove()

  var brush_fn = d3.svg.brush()
        .x(d3.scale.identity().domain([ x, x + width ]))
        .y(d3.scale.identity().domain([ y, y + height ]))
        .on('brushstart', function () {
          // unhide secondary metabolites if they are hidden
          if (map.settings.get_option('hide_secondary_metabolites')) {
            map.settings.set_conditional('hide_secondary_metabolites', false)
            map.draw_everything()
            map.set_status('Showing secondary metabolites. You can hide them ' +
                           'again in Settings.', 2000)
          }
        })
        .on('brush', function () {
          var shift_key_on = d3.event.sourceEvent.shiftKey
          var extent = d3.event.target.extent()
          // When shift is pressed, ignore the currently selected nodes.
          // Otherwise, brush all nodes.
          var selection = shift_key_on ?
                selectable_selection.selectAll('.node:not(.selected),.text-label:not(.selected)') :
                selectable_selection.selectAll('.node,.text-label')
          selection.classed('selected', function (d) {
            var sx = d.x
            var sy = d.y
            return (extent[0][0] <= sx && sx < extent[1][0] &&
                    extent[0][1] <= sy && sy < extent[1][1])
          })
        })
        .on('brushend', function () {
          d3.event.target.clear()
          d3.select(this).call(d3.event.target)
        })
  var brush = selection.append('g')
        .attr('class', 'brush')
        .call(brush_fn)

  // turn off the mouse crosshair
  selection.selectAll('.background')
    .classed('cursor-grab', false)
    .classed('cursor-grabbing', false)
    .style('cursor', null)

  return brush
}

},{"./utils":33}],3:[function(require,module,exports){
/** BuildInput

 Arguments
 ---------

 selection: A d3 selection for the BuildInput.

 map: A Map instance.

 zoom_container: A ZoomContainer instance.

 settings: A Settings instance.

  */

/* global d3 */

var utils = require('./utils');
var PlacedDiv = require('./PlacedDiv');
var completely = require('./complete.ly');
var DirectionArrow = require('./DirectionArrow');
var CobraModel = require('./CobraModel');

var _ = require('underscore');


var BuildInput = utils.make_class();
BuildInput.prototype = {
    init: init,
    setup_map_callbacks: setup_map_callbacks,
    setup_zoom_callbacks: setup_zoom_callbacks,
    is_visible: is_visible,
    toggle: toggle,
    show_dropdown: show_dropdown,
    hide_dropdown: hide_dropdown,
    place_at_selected: place_at_selected,
    place: place,
    reload_at_selected: reload_at_selected,
    reload: reload,
    toggle_start_reaction_listener: toggle_start_reaction_listener,
    hide_target: hide_target,
    show_target: show_target
};
module.exports = BuildInput;


function init(selection, map, zoom_container, settings) {
    // set up container
    var new_sel = selection.append('div').attr('id', 'rxn-input');
    this.placed_div = PlacedDiv(new_sel, map, {x: 240, y: 0});
    this.placed_div.hide();

    // set up complete.ly
    var c = completely(new_sel.node(), { backgroundColor: '#eee' });

    d3.select(c.input);
    this.completely = c;
    // close button
    new_sel.append('button').attr('class', "button input-close-button")
        .text("×")
        .on('mousedown', function() { this.hide_dropdown(); }.bind(this));

    // map
    this.map = map;
    // set up the reaction direction arrow
    var default_angle = 90; // degrees
    this.direction_arrow = new DirectionArrow(map.sel);
    this.direction_arrow.set_rotation(default_angle);
    this.setup_map_callbacks(map);

    // zoom container
    this.zoom_container = zoom_container;
    this.setup_zoom_callbacks(zoom_container);

    // settings
    this.settings = settings;

    // toggle off
    this.toggle(false);
    this.target_coords = null;
}

function setup_map_callbacks(map) {
    // input
    map.callback_manager.set('select_metabolite_with_id.input', function(selected_node, coords) {
        if (this.is_active) {
            this.reload(selected_node, coords, false);
            this.show_dropdown(coords);
        }
        this.hide_target();
    }.bind(this));
    map.callback_manager.set('select_selectable.input', function(count, selected_node, coords) {
        this.hide_target();
        if (count == 1 && this.is_active && coords) {
            this.reload(selected_node, coords, false);
            this.show_dropdown(coords);
        } else {
            this.toggle(false);
        }
    }.bind(this));
    map.callback_manager.set('deselect_nodes', function() {
        this.direction_arrow.hide();
        this.hide_dropdown();
    }.bind(this));

    // svg export
    map.callback_manager.set('before_svg_export', function() {
        this.direction_arrow.hide();
        this.hide_target();
    }.bind(this));
}

function setup_zoom_callbacks(zoom_container) {
    zoom_container.callback_manager.set('zoom.input', function() {
        if (this.is_active) {
            this.place_at_selected();
        }
    }.bind(this));
}

function is_visible() {
    return this.placed_div.is_visible();
}

function toggle(on_off) {
    if (on_off===undefined) this.is_active = !this.is_active;
    else this.is_active = on_off;
    if (this.is_active) {
        this.toggle_start_reaction_listener(true);
        if (_.isNull(this.target_coords))
            this.reload_at_selected();
        else
            this.placed_div.place(this.target_coords);
        this.show_dropdown();
        this.map.set_status('Click on the canvas or an existing metabolite');
        this.direction_arrow.show();
    } else {
        this.toggle_start_reaction_listener(false);
        this.hide_dropdown();
        this.map.set_status(null);
        this.direction_arrow.hide();
    }
}

function show_dropdown(coords) {
    // escape key
    this.clear_escape = this.map.key_manager
        .add_escape_listener(function() {
            this.hide_dropdown();
        }.bind(this), true);
    // dropdown
    this.completely.input.blur();
    this.completely.repaint();
    this.completely.setText('');
    this.completely.input.focus();
}

function hide_dropdown() {
    // escape key
    if (this.clear_escape) this.clear_escape();
    this.clear_escape = null;
    // dropdown
    this.placed_div.hide();
    this.completely.input.blur();
    this.completely.hideDropDown();
}

function place_at_selected() {
    /** Place autocomplete box at the first selected node. */
    // get the selected node
    this.map.deselect_text_labels();
    var selected_node = this.map.select_single_node();
    if (selected_node==null) return;
    var coords = { x: selected_node.x, y: selected_node.y };
    this.place(coords);
}

function place(coords) {
    this.placed_div.place(coords);
    this.direction_arrow.set_location(coords);
    this.direction_arrow.show();
}

function reload_at_selected() {
    /** Reload data for autocomplete box and redraw box at the first selected
     node. */
    // get the selected node
    this.map.deselect_text_labels();
    var selected_node = this.map.select_single_node();
    if (selected_node==null) return false;
    var coords = { x: selected_node.x, y: selected_node.y };
    // reload the reaction input
    this.reload(selected_node, coords, false);
    return true;
}

function reload(selected_node, coords, starting_from_scratch) {
    /** Reload data for autocomplete box and redraw box at the new
     coordinates. */

    // try finding the selected node
    if (!starting_from_scratch && !selected_node) {
        console.error('No selected node, and not starting from scratch');
        return;
    }

    this.place(coords);

    if (this.map.cobra_model===null) {
        this.completely.setText('Cannot add: No model.');
        return;
    }

    // settings
    var show_names = this.settings.get_option('identifiers_on_map') == 'name',
        allow_duplicates = this.settings.get_option('allow_building_duplicate_reactions');

    // Find selected
    var options = [],
        cobra_reactions = this.map.cobra_model.reactions,
        cobra_metabolites = this.map.cobra_model.metabolites,
        reactions = this.map.reactions,
        has_data_on_reactions = this.map.has_data_on_reactions,
        reaction_data = this.map.reaction_data,
        reaction_data_styles = this.map.reaction_data_styles,
        selected_m_name = (selected_node ? (show_names ? selected_node.name : selected_node.bigg_id) : ''),
        bold_mets_in_str = function(str, mets) {
            return str.replace(new RegExp('(^| )(' + mets.join('|') + ')($| )', 'g'),
                               '$1<b>$2</b>$3');
        };

    // for reactions
    var reaction_suggestions = {};
    for (var bigg_id in cobra_reactions) {
        var reaction = cobra_reactions[bigg_id],
            reaction_name = reaction.name,
            show_r_name = (show_names ? reaction_name : bigg_id);

        // ignore drawn reactions
        if ((!allow_duplicates) && already_drawn(bigg_id, reactions))
            continue;

        // check segments for match to selected metabolite
        for (var met_bigg_id in reaction.metabolites) {

            // if starting with a selected metabolite, check for that id
            if (starting_from_scratch || met_bigg_id == selected_node.bigg_id) {

                // don't add suggestions twice
                if (bigg_id in reaction_suggestions) continue;

                var met_name = cobra_metabolites[met_bigg_id].name;

                if (has_data_on_reactions) {
                    options.push({ reaction_data: reaction.data,
                                   html: ('<b>' + show_r_name + '</b>' +
                                          ': ' +
                                          reaction.data_string),
                                   matches: [show_r_name],
                                   id: bigg_id });
                    reaction_suggestions[bigg_id] = true;
                } else {
                    // get the metabolite names or IDs
                    var mets = {},
                        show_met_names = [],
                        met_id;
                    if (show_names) {
                        for (met_id in reaction.metabolites) {
                            var name = cobra_metabolites[met_id].name;
                            mets[name] = reaction.metabolites[met_id];
                            show_met_names.push(name);
                        }
                    } else {
                        mets = utils.clone(reaction.metabolites);
                        for (met_id in reaction.metabolites) {
                            show_met_names.push(met_id);
                        }
                    }
                    var show_gene_names = _.flatten(reaction.genes.map(function(g_obj) {
                        return [g_obj.name, g_obj.bigg_id];
                    }));
                    // get the reaction string
                    var reaction_string = CobraModel.build_reaction_string(mets,
                                                                           reaction.reversibility,
                                                                           reaction.lower_bound,
                                                                           reaction.upper_bound);
                    options.push({ html: ('<b>' + show_r_name + '</b>' +
                                          '\t' +
                                          bold_mets_in_str(reaction_string, [selected_m_name])),
                                   matches: [show_r_name].concat(show_met_names).concat(show_gene_names),
                                   id: bigg_id });
                    reaction_suggestions[bigg_id] = true;
                }
            }
        }
    }

    // Generate the array of reactions to suggest and sort it
    var sort_fn;
    if (has_data_on_reactions) {
        sort_fn = function(x, y) {
            return Math.abs(y.reaction_data) - Math.abs(x.reaction_data);
        };
    } else {
        sort_fn = function(x, y) {
            return (x.html.toLowerCase() < y.html.toLowerCase() ? -1 : 1);
        };
    }
    options = options.sort(sort_fn);
    // set up the box with data
    var complete = this.completely;
    complete.options = options;

    // TODO test this behavior
    // if (strings_to_display.length==1) complete.setText(strings_to_display[0]);
    // else complete.setText("");
    complete.setText('');

    var direction_arrow = this.direction_arrow,
        check_and_build = function(id) {
            if (id !== null) {
                // make sure the selected node exists, in case changes were made in the meantime
                if (starting_from_scratch) {
                    this.map.new_reaction_from_scratch(id,
                                                       coords,
                                                       direction_arrow.get_rotation());
                } else {
                    if (!(selected_node.node_id in this.map.nodes)) {
                        console.error('Selected node no longer exists');
                        this.hide_dropdown();
                        return;
                    }
                    this.map.new_reaction_for_metabolite(id,
                                                         selected_node.node_id,
                                                         direction_arrow.get_rotation());
                }
            }
        }.bind(this);
    complete.onEnter = function(id) {
        this.setText('');
        this.onChange('');
        check_and_build(id);
    };

    //definitions
    function already_drawn(bigg_id, reactions) {
        for (var drawn_id in reactions) {
            if (reactions[drawn_id].bigg_id==bigg_id)
                return true;
        }
        return false;
    };
}

function toggle_start_reaction_listener(on_off) {
    /** Toggle listening for a click to place a new reaction on the canvas. */
    if (on_off===undefined)
        this.start_reaction_listener = !this.start_reaction_listener;
    else if (this.start_reaction_listener==on_off)
        return;
    else
        this.start_reaction_listener = on_off;

    if (this.start_reaction_listener) {
        this.map.sel.on('click.start_reaction', function(node) {
            // TODO fix this hack
            if (this.direction_arrow.dragging) return;
            // reload the reaction input
            var coords = { x: d3.mouse(node)[0],
                           y: d3.mouse(node)[1] };
            // unselect metabolites
            this.map.deselect_nodes();
            this.map.deselect_text_labels();
            // reload the reaction input
            this.reload(null, coords, true);
            // generate the target symbol
            this.show_target(this.map, coords);
            // show the dropdown
            this.show_dropdown(coords);
        }.bind(this, this.map.sel.node()));
        this.map.sel.classed('start-reaction-cursor', true);
    } else {
        this.map.sel.on('click.start_reaction', null);
        this.map.sel.classed('start-reaction-cursor', false);
        this.hide_target();
    }
}

function hide_target() {
    if (this.target_coords)
        this.map.sel.selectAll('.start-reaction-target').remove();
    this.target_coords = null;
}

function show_target(map, coords) {
    var s = map.sel.selectAll('.start-reaction-target').data([12, 5]);
    s.enter().append('circle')
        .classed('start-reaction-target', true)
        .attr('r', function(d) { return d; })
        .style('stroke-width', 4);
    s.style('visibility', 'visible')
        .attr('transform', 'translate('+coords.x+','+coords.y+')');
    this.target_coords = coords;
}

},{"./CobraModel":7,"./DirectionArrow":9,"./PlacedDiv":13,"./complete.ly":27,"./utils":33,"underscore":38}],4:[function(require,module,exports){
/**
 * For documentation of this class, see docs/javascript_api.rst
 */

/* global d3 */

var utils = require('./utils');
var BuildInput = require('./BuildInput');
var ZoomContainer = require('./ZoomContainer');
var Map = require('./Map');
var CobraModel = require('./CobraModel');
var Brush = require('./Brush');
var CallbackManager = require('./CallbackManager');
var ui = require('./ui');
var SearchBar = require('./SearchBar');
var Settings = require('./Settings');
var SettingsMenu = require('./SettingsMenu');
var TextEditInput = require('./TextEditInput');
var QuickJump = require('./QuickJump');
var data_styles = require('./data_styles');
var builder_embed = require('./inline').builder_embed;
var TooltipContainer = require('./TooltipContainer')
var DefaultTooltip = require('./Tooltip').DefaultTooltip
var _ = require('underscore')

var Builder = utils.make_class();
Builder.prototype = {
    init: init,
    load_map: load_map,
    load_model: load_model,
    _set_mode: _set_mode,
    view_mode: view_mode,
    build_mode: build_mode,
    brush_mode: brush_mode,
    zoom_mode: zoom_mode,
    rotate_mode: rotate_mode,
    text_mode: text_mode,
    set_reaction_data: set_reaction_data,
    set_metabolite_data: set_metabolite_data,
    set_gene_data: set_gene_data,
    _update_data: _update_data,
    _toggle_direction_buttons: _toggle_direction_buttons,
    _set_up_menu: _set_up_menu,
    _set_up_button_panel: _set_up_button_panel,
    _setup_status: _setup_status,
    _setup_quick_jump: _setup_quick_jump,
    _setup_modes: _setup_modes,
    _get_keys: _get_keys,
    _setup_confirm_before_exit: _setup_confirm_before_exit
};
module.exports = Builder;


function init (map_data, model_data, embedded_css, selection, options) {

  // defaults
  if (!selection) {
    selection = d3.select('body').append('div')
  }
  if (!options) {
    options = {}
  }
  if (!embedded_css) {
    embedded_css = builder_embed
  }

  this.map_data = map_data
  this.model_data = model_data
  this.embedded_css = embedded_css
  this.selection = selection

  // apply this object as data for the selection
  this.selection.datum(this)
  this.selection.__builder__ = this

  // set defaults
  this.options = utils.set_options(options, {
    // view options
    menu: 'all',
    scroll_behavior: 'pan',
    use_3d_transform: !utils.check_browser('safari'),
    enable_editing: true,
    enable_keys: true,
    enable_search: true,
    fill_screen: false,
    zoom_to_element: null,
    full_screen_button: false,
    ignore_bootstrap: false,
    // map, model, and styles
    starting_reaction: null,
    never_ask_before_quit: false,
    unique_map_id: null,
    primary_metabolite_radius: 20,
    secondary_metabolite_radius: 10,
    marker_radius: 5,
    gene_font_size: 18,
    hide_secondary_metabolites: false,
    show_gene_reaction_rules: false,
    hide_all_labels: false,
    // applied data
    // reaction
    reaction_data: null,
    reaction_styles: ['color', 'size', 'text'],
    reaction_compare_style: 'log2_fold',
    reaction_scale: [{ type: 'min', color: '#c8c8c8', size: 12 },
                     { type: 'median', color: '#9696ff', size: 20 },
                     { type: 'max', color: '#ff0000', size: 25 }],
    reaction_no_data_color: '#dcdcdc',
    reaction_no_data_size: 8,
    // gene
    gene_data: null,
    and_method_in_gene_reaction_rule: 'mean',
    // metabolite
    metabolite_data: null,
    metabolite_styles: ['color', 'size', 'text'],
    metabolite_compare_style: 'log2_fold',
    metabolite_scale: [ { type: 'min', color: '#fffaf0', size: 20 },
                        { type: 'median', color: '#f1c470', size: 30 },
                        { type: 'max', color: '#800000', size: 40 } ],
    metabolite_no_data_color: '#ffffff',
    metabolite_no_data_size: 10,
    // View and build options
    identifiers_on_map: 'bigg_id',
    highlight_missing: false,
    allow_building_duplicate_reactions: false,
    cofactors: ['atp', 'adp', 'nad', 'nadh', 'nadp', 'nadph', 'gtp', 'gdp',
                'h', 'coa', 'ump', 'h20', 'ppi'],
    // Extensions
    tooltip_component: DefaultTooltip,
    enable_tooltips: true,
    // Callbacks
    first_load_callback: null,
  }, {
    primary_metabolite_radius: true,
    secondary_metabolite_radius: true,
    marker_radius: true,
    gene_font_size: true,
    reaction_no_data_size: true,
    metabolite_no_data_size: true,
  })

  // check the location
  if (utils.check_for_parent_tag(this.selection, 'svg')) {
    throw new Error('Builder cannot be placed within an svg node '+
                    'becuase UI elements are html-based.')
  }

  // Initialize the settings
  var set_option = function (option, new_value) {
    this.options[option] = new_value
  }.bind(this)
  var get_option = function (option) {
    return this.options[option]
  }.bind(this)
  // the options that are erased when the settings menu is canceled
  var conditional = [ 'hide_secondary_metabolites', 'show_gene_reaction_rules',
                      'hide_all_labels', 'scroll_behavior', 'reaction_styles',
                      'reaction_compare_style', 'reaction_scale',
                      'reaction_no_data_color', 'reaction_no_data_size',
                      'and_method_in_gene_reaction_rule', 'metabolite_styles',
                      'metabolite_compare_style', 'metabolite_scale',
                      'metabolite_no_data_color', 'metabolite_no_data_size',
                      'identifiers_on_map', 'highlight_missing',
                      'allow_building_duplicate_reactions', 'enable_tooltips' ]
  this.settings = new Settings(set_option, get_option, conditional)

  // check the scales have max and min
  var scales = [ 'reaction_scale', 'metabolite_scale' ]
  scales.forEach(function(name) {
    this.settings.streams[name].onValue(function(val) {
      ['min', 'max'].forEach(function(type) {
        var has = val.reduce(function(has_found, scale_el) {
          return has_found || (scale_el.type == type)
        }, false)
        if (!has) {
          val.push({ type: type, color: '#ffffff', size: 10 })
          this.settings.set_conditional(name, val)
        }
      }.bind(this))
    }.bind(this))
  }.bind(this))
  // TODO warn about repeated types in the scale

  // set up this callback manager
  this.callback_manager = CallbackManager()
  if (this.options.first_load_callback !== null) {
    this.callback_manager.set('first_load', this.options.first_load_callback)
  }

  // load the model, map, and update data in both
  this.load_model(this.model_data, false)
  this.load_map(this.map_data, false)
  this._update_data(true, true)

  // Setting callbacks. TODO enable atomic updates. Right now, every time the
  // menu closes, everything is drawn.
  this.settings.status_bus
    .onValue(function(x) {
      if (x === 'accepted') {
        this._update_data(true, true, [ 'reaction', 'metabolite' ], false)
        if (this.zoom_container !== null) {
          var new_behavior = this.settings.get_option('scroll_behavior')
          this.zoom_container.set_scroll_behavior(new_behavior)
        }
        if (this.map !== null) {
          this.map.draw_all_nodes(false)
          this.map.draw_all_reactions(true, false)
          this.map.select_none()
        }
      }
    }.bind(this))

  this.callback_manager.run('first_load', this)
}

function load_model(model_data, should_update_data) {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    if (should_update_data === undefined)
        should_update_data = true;

    // Check the cobra model
    if (model_data === null)
        this.cobra_model = null;
    else
        this.cobra_model = CobraModel.from_cobra_json(model_data);

    if (this.map) {
        this.map.cobra_model = this.cobra_model;
        if (should_update_data)
            this._update_data(true, false);
        if (this.settings.get_option('highlight_missing'))
            this.map.draw_all_reactions(false, false);
    }

    this.callback_manager.run('load_model', null, model_data, should_update_data);
}

/**
 * For documentation of this function, see docs/javascript_api.rst
 */
function load_map(map_data, should_update_data) {
    if (_.isUndefined(should_update_data))
        should_update_data = true

    // Begin with some definitions
    var selectable_mousedown_enabled = true
    var shift_key_on = false

    // remove the old builder
    utils.remove_child_nodes(this.selection)

    // set up the zoom container
    this.zoom_container = new ZoomContainer(this.selection,
                                            this.options.scroll_behavior,
                                            this.options.use_3d_transform,
                                            this.options.fill_screen)
    var zoomed_sel = this.zoom_container.zoomed_sel
    var svg = this.zoom_container.svg

    // remove the old map side effects
    if (this.map)
        this.map.key_manager.toggle(false)

    if (map_data !== null) {
        // import map
        this.map = Map.from_data(map_data,
                                 svg,
                                 this.embedded_css,
                                 zoomed_sel,
                                 this.zoom_container,
                                 this.settings,
                                 this.cobra_model,
                                 this.options.enable_search)
    } else {
        // new map
        this.map = new Map(svg,
                           this.embedded_css,
                           zoomed_sel,
                           this.zoom_container,
                           this.settings,
                           this.cobra_model,
                           null,
                           this.options.enable_search)
    }
    // zoom container status changes
    this.zoom_container.callback_manager.set('svg_start', function() {
        this.map.set_status('Drawing ...')
    }.bind(this))
    this.zoom_container.callback_manager.set('svg_finish', function() {
        this.map.set_status('')
    }.bind(this))

    // set the data for the map
    if (should_update_data)
        this._update_data(false, true)

    // set up the reaction input with complete.ly
    this.build_input = new BuildInput(this.selection, this.map,
                                      this.zoom_container, this.settings)

    // set up the text edit input
    this.text_edit_input = new TextEditInput(this.selection, this.map,
                                             this.zoom_container)

    // set up the tooltip container
    this.tooltip_container = new TooltipContainer(this.selection, this.map,
                                                  this.options.tooltip_component,
                                                  this.zoom_container)

    // set up the Brush
    this.brush = new Brush(zoomed_sel, false, this.map, '.canvas-group')
    this.map.canvas.callback_manager.set('resize', function() {
        this.brush.toggle(true)
    }.bind(this))

    // set up the modes
    this._setup_modes(this.map, this.brush, this.zoom_container)

    var s = this.selection
            .append('div').attr('class', 'search-menu-container')
            .append('div').attr('class', 'search-menu-container-inline'),
        menu_div = s.append('div'),
        search_bar_div = s.append('div'),
        button_div = this.selection.append('div')

    // set up the search bar
    this.search_bar = new SearchBar(search_bar_div, this.map.search_index,
                                this.map)
    // set up the hide callbacks
    this.search_bar.callback_manager.set('show', function() {
        this.settings_bar.toggle(false)
    }.bind(this))

    // set up the settings
    var settings_div = this.selection.append('div')
    this.settings_bar = new SettingsMenu(settings_div, this.settings, this.map,
                                         function(type, on_off) {
                                             // temporarily set the abs type, for
                                             // previewing it in the Settings
                                             // menu
                                             var o = this.options[type + '_styles']
                                             if (on_off && o.indexOf('abs') == -1)
                                                 o.push('abs')
                                             else if (!on_off) {
                                                 var i = o.indexOf('abs')
                                                 if (i != -1)
                                                     this.options[type + '_styles'] = o.slice(0, i).concat(o.slice(i + 1))
                                             }
                                             this._update_data(false, true, type)
                                         }.bind(this))
    this.settings_bar.callback_manager.set('show', function() {
        this.search_bar.toggle(false)
    }.bind(this))

    // set up key manager
    var keys = this._get_keys(this.map, this.zoom_container,
                              this.search_bar, this.settings_bar,
                              this.options.enable_editing,
                              this.options.full_screen_button)
    this.map.key_manager.assigned_keys = keys
    // tell the key manager about the reaction input and search bar
    this.map.key_manager.input_list = [this.build_input, this.search_bar,
                                       this.settings_bar, this.text_edit_input]
    // make sure the key manager remembers all those changes
    this.map.key_manager.update()
    // turn it on/off
    this.map.key_manager.toggle(this.options.enable_keys)

    // set up menu and status bars
    if (this.options.menu === 'all') {
        if (this.options.ignore_bootstrap)
            console.error('Cannot create the dropdown menus if ignore_bootstrap = true')
        else
            this._set_up_menu(menu_div, this.map, this.map.key_manager, keys,
                              this.options.enable_editing, this.options.enable_keys,
                              this.options.full_screen_button)
    }

    this._set_up_button_panel(button_div, keys, this.options.enable_editing,
                              this.options.enable_keys,
                              this.options.full_screen_button,
                              this.options.menu, this.options.ignore_bootstrap)

    // setup selection box
    if (this.options.zoom_to_element) {
        var type = this.options.zoom_to_element.type,
            element_id = this.options.zoom_to_element.id
        if (typeof type === 'undefined' || ['reaction', 'node'].indexOf(type) == -1)
            throw new Error('zoom_to_element type must be "reaction" or "node"')
        if (typeof element_id === 'undefined')
            throw new Error('zoom_to_element must include id')
        if (type == 'reaction')
            this.map.zoom_to_reaction(element_id)
        else if (type == 'node')
            this.map.zoom_to_node(element_id)
    } else if (map_data !== null) {
        this.map.zoom_extent_canvas()
    } else {
        if (this.options.starting_reaction !== null && this.cobra_model !== null) {
            // Draw default reaction if no map is provided
            var size = this.zoom_container.get_size()
            var start_coords = { x: size.width / 2,
                                 y: size.height / 4 }
            this.map.new_reaction_from_scratch(this.options.starting_reaction, start_coords, 90)
            this.map.zoom_extent_nodes()
        } else {
            this.map.zoom_extent_canvas()
        }
    }

    // status in both modes
    var status = this._setup_status(this.selection, this.map)

    // set up quick jump
    this._setup_quick_jump(this.selection)

    // start in zoom mode for builder, view mode for viewer
    if (this.options.enable_editing)
        this.zoom_mode()
    else
        this.view_mode()

    // confirm before leaving the page
    if (this.options.enable_editing)
        this._setup_confirm_before_exit()

    // draw
    this.map.draw_everything()
}

function _set_mode(mode) {
  this.search_bar.toggle(false)
  // input
  this.build_input.toggle(mode == 'build')
  this.build_input.direction_arrow.toggle(mode == 'build')
  if (this.options.menu == 'all' && this.options.enable_editing) {
    this._toggle_direction_buttons(mode == 'build')
  }
  // brush
  this.brush.toggle(mode == 'brush')
  // zoom
  this.zoom_container.toggle_pan_drag(mode == 'zoom' || mode == 'view')
  // resize canvas
  this.map.canvas.toggle_resize(mode == 'zoom' || mode == 'brush')
  // Behavior. Be careful of the order becuase rotation and
  // toggle_selectable_drag both use Behavior.selectable_drag.
  if (mode  ==  'rotate') {
    this.map.behavior.toggle_selectable_drag(false) // before toggle_rotation_mode
    this.map.behavior.toggle_rotation_mode(true)
  } else {
    this.map.behavior.toggle_rotation_mode(mode == 'rotate') // before toggle_selectable_drag
    this.map.behavior.toggle_selectable_drag(mode == 'brush')
  }
  this.map.behavior.toggle_selectable_click(mode == 'build' || mode == 'brush')
  this.map.behavior.toggle_label_drag(mode == 'brush')
  this.map.behavior.toggle_label_mouseover(true)
  this.map.behavior.toggle_text_label_edit(mode == 'text')
  this.map.behavior.toggle_bezier_drag(mode == 'brush')
  // edit selections
  if (mode == 'view' || mode == 'text')
    this.map.select_none()
  if (mode == 'rotate')
    this.map.deselect_text_labels()
  this.map.draw_everything()
}

function view_mode() {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.callback_manager.run('view_mode');
    this._set_mode('view');
}

function build_mode() {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.callback_manager.run('build_mode');
    this._set_mode('build');
}

function brush_mode() {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.callback_manager.run('brush_mode');
    this._set_mode('brush');
}

function zoom_mode() {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.callback_manager.run('zoom_mode');
    this._set_mode('zoom');
}

function rotate_mode() {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.callback_manager.run('rotate_mode');
    this._set_mode('rotate');
}

function text_mode() {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.callback_manager.run('text_mode');
    this._set_mode('text');
}

function set_reaction_data(data) {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.options.reaction_data = data;
    this._update_data(true, true, 'reaction');
    this.map.set_status('');
}

function set_gene_data(data, clear_gene_reaction_rules) {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    if (clear_gene_reaction_rules) // default undefined
        this.settings.set_conditional('show_gene_reaction_rules', false);
    this.options.gene_data = data;
    this._update_data(true, true, 'reaction');
    this.map.set_status('');
}

function set_metabolite_data(data) {
    /** For documentation of this function, see docs/javascript_api.rst.

     */
    this.options.metabolite_data = data;
    this._update_data(true, true, 'metabolite');
    this.map.set_status('');
}

function _update_data(update_model, update_map, kind, should_draw) {
    /** Set data and settings for the model.

     Arguments
     ---------

     update_model: (Boolean) Update data for the model.

     update_map: (Boolean) Update data for the map.

     kind: (Optional, Default: all) An array defining which data is being
     updated that can include any of: ['reaction', 'metabolite'].

     should_draw: (Optional, Default: true) Whether to redraw the update
     sections of the map.

     */

    // defaults
    if (kind === undefined)
        kind = ['reaction', 'metabolite'];
    if (should_draw === undefined)
        should_draw = true;

    var update_metabolite_data = (kind.indexOf('metabolite') != -1),
        update_reaction_data = (kind.indexOf('reaction') != -1),
        met_data_object,
        reaction_data_object,
        gene_data_object;

    // -------------------
    // First map, and draw

    // metabolite data
    if (update_metabolite_data && update_map && this.map !== null) {
        met_data_object = data_styles.import_and_check(this.options.metabolite_data,
                                                       'metabolite_data');
        this.map.apply_metabolite_data_to_map(met_data_object);
        if (should_draw)
            this.map.draw_all_nodes(false);
    }

    // reaction data
    if (update_reaction_data) {
        if (this.options.reaction_data !== null && update_map && this.map !== null) {
            reaction_data_object = data_styles.import_and_check(this.options.reaction_data,
                                                                'reaction_data');
            this.map.apply_reaction_data_to_map(reaction_data_object);
            if (should_draw)
                this.map.draw_all_reactions(false, false);
        } else if (this.options.gene_data !== null && update_map && this.map !== null) {
            gene_data_object = make_gene_data_object(this.options.gene_data,
                                                     this.cobra_model, this.map);
            this.map.apply_gene_data_to_map(gene_data_object);
            if (should_draw)
                this.map.draw_all_reactions(false, false);
        } else if (update_map && this.map !== null) {
            // clear the data
            this.map.apply_reaction_data_to_map(null);
            if (should_draw)
                this.map.draw_all_reactions(false, false);
        }
    }

    // ----------------------------------------------------------------
    // Then the model, after drawing. Delay by 5ms so the the map draws
    // first.
    // ----------------------------------------------------------------

    // if this function runs again, cancel the previous model update
    if (this.update_model_timer)
        clearTimeout(this.update_model_timer);

    var delay = 5;
    this.update_model_timer = setTimeout(function() {

        // metabolite_data
        if (update_metabolite_data && update_model && this.cobra_model !== null) {
            // if we haven't already made this
            if (!met_data_object)
                met_data_object = data_styles.import_and_check(this.options.metabolite_data,
                                                               'metabolite_data');
            this.cobra_model.apply_metabolite_data(met_data_object,
                                                   this.options.metabolite_styles,
                                                   this.options.metabolite_compare_style);
        }

        // reaction data
        if (update_reaction_data) {
            if (this.options.reaction_data !== null && update_model && this.cobra_model !== null) {
                // if we haven't already made this
                if (!reaction_data_object)
                    reaction_data_object = data_styles.import_and_check(this.options.reaction_data,
                                                                        'reaction_data');
                this.cobra_model.apply_reaction_data(reaction_data_object,
                                                     this.options.reaction_styles,
                                                     this.options.reaction_compare_style);
            } else if (this.options.gene_data !== null && update_model && this.cobra_model !== null) {
                if (!gene_data_object)
                    gene_data_object = make_gene_data_object(this.options.gene_data,
                                                             this.cobra_model, this.map);
                this.cobra_model.apply_gene_data(gene_data_object,
                                                 this.options.reaction_styles,
                                                 this.options.identifiers_on_map,
                                                 this.options.reaction_compare_style,
                                                 this.options.and_method_in_gene_reaction_rule);
            } else if (update_model && this.cobra_model !== null) {
                // clear the data
                this.cobra_model.apply_reaction_data(null,
                                                     this.options.reaction_styles,
                                                     this.options.reaction_compare_style);
            }
        }

        // callback
        this.callback_manager.run('update_data', null, update_model, update_map, kind, should_draw);

    }.bind(this), delay);

    // definitions
    function make_gene_data_object(gene_data, cobra_model, map) {
        var all_reactions = {};
        if (cobra_model !== null)
            utils.extend(all_reactions, cobra_model.reactions);
        // extend, overwrite
        if (map !== null)
            utils.extend(all_reactions, map.reactions, true);

        // this object has reaction keys and values containing associated genes
        return data_styles.import_and_check(gene_data, 'gene_data', all_reactions);
    }
}

function _set_up_menu(menu_selection, map, key_manager, keys, enable_editing,
                      enable_keys, full_screen_button, ignore_bootstrap) {
    var menu = menu_selection.attr('id', 'menu')
            .append('ul')
            .attr('class', 'nav nav-pills')
    // map dropdown
    ui.dropdown_menu(menu, 'Map')
        .button({ key: keys.save,
                  text: 'Save map JSON',
                  key_text: (enable_keys ? ' (Ctrl+S)' : null) })
        .button({ text: 'Load map JSON',
                  key_text: (enable_keys ? ' (Ctrl+O)' : null),
                  input: { assign: key_manager.assigned_keys.load,
                           key: 'fn',
                           fn: load_map_for_file.bind(this),
                           pre_fn: function() {
                               map.set_status('Loading map ...')
                           },
                           failure_fn: function() {
                               map.set_status('')
                           }}
                })
        .button({ key: keys.save_svg,
                  text: 'Export as SVG',
                  key_text: (enable_keys ? ' (Ctrl+Shift+S)' : null) })
        .button({ key: keys.save_png,
                  text: 'Export as PNG',
                  key_text: (enable_keys ? ' (Ctrl+Shift+P)' : null) })
        .button({ key: keys.clear_map,
                  text: 'Clear map' })
    // model dropdown
    var model_menu = ui.dropdown_menu(menu, 'Model')
            .button({ text: 'Load COBRA model JSON',
                      key_text: (enable_keys ? ' (Ctrl+M)' : null),
                      input: { assign: key_manager.assigned_keys.load_model,
                               key: 'fn',
                               fn: load_model_for_file.bind(this),
                               pre_fn: function() {
                                   map.set_status('Loading model ...')
                               },
                               failure_fn: function() {
                                   map.set_status('')
                               } }
                    })
            .button({ id: 'convert_map',
                      key: keys.convert_map,
                      text: 'Update names and gene reaction rules using model' })
            .button({ id: 'clear_model',
                      key: keys.clear_model,
                      text: 'Clear model' })
    // disable the clear and convert buttons
    var disable_model_clear_convert = function() {
        model_menu.dropdown.selectAll('li')
            .classed('escher-disabled', function(d) {
                if ((d.id == 'clear_model' || d.id == 'convert_map') &&
                    this.cobra_model === null)
                    return true
                return null
            }.bind(this))
    }.bind(this)
    disable_model_clear_convert()
    this.callback_manager.set('load_model', disable_model_clear_convert)

    // data dropdown
    var data_menu = ui.dropdown_menu(menu, 'Data')
            .button({ input: { assign: key_manager.assigned_keys.load_reaction_data,
                               key: 'fn',
                               fn: load_reaction_data_for_file.bind(this),
                               accept_csv: true,
                               pre_fn: function() {
                                   map.set_status('Loading reaction data ...')
                               },
                               failure_fn: function() {
                                   map.set_status('')
                               }},
                      text: 'Load reaction data' })
            .button({ key: keys.clear_reaction_data,
                      text: 'Clear reaction data' })
            .divider()
            .button({ input: { fn: load_gene_data_for_file.bind(this),
                               accept_csv: true,
                               pre_fn: function() {
                                   map.set_status('Loading gene data ...')
                               },
                               failure_fn: function() {
                                   map.set_status('')
                               }},
                      text: 'Load gene data' })
            .button({ key: keys.clear_gene_data,
                      text: 'Clear gene data' })
            .divider()
            .button({ input: { fn: load_metabolite_data_for_file.bind(this),
                               accept_csv: true,
                               pre_fn: function() {
                                   map.set_status('Loading metabolite data ...')
                               },
                               failure_fn: function() {
                                   map.set_status('')
                               }},
                      text: 'Load metabolite data' })
            .button({ key: keys.clear_metabolite_data,
                      text: 'Clear metabolite data' })

    // update the buttons
    var disable_clears = function() {
        data_menu.dropdown.selectAll('li')
            .classed('escher-disabled', function(d) {
                if (!d) return null
                if (d.text == 'Clear reaction data' && this.options.reaction_data === null)
                    return true
                if (d.text == 'Clear gene data' && this.options.gene_data === null)
                    return true
                if (d.text == 'Clear metabolite data' && this.options.metabolite_data === null)
                    return true
                return null
            }.bind(this))
    }.bind(this)
    disable_clears()
    this.callback_manager.set('update_data', disable_clears)

    // edit dropdown
    var edit_menu = ui.dropdown_menu(menu, 'Edit', true)
    if (enable_editing) {
        edit_menu
            .button({ key: keys.zoom_mode,
                      id: 'zoom-mode-menu-button',
                      text: 'Pan mode',
                      key_text: (enable_keys ? ' (Z)' : null) })
            .button({ key: keys.brush_mode,
                      id: 'brush-mode-menu-button',
                      text: 'Select mode',
                      key_text: (enable_keys ? ' (V)' : null) })
            .button({ key: keys.build_mode,
                      id: 'build-mode-menu-button',
                      text: 'Add reaction mode',
                      key_text: (enable_keys ? ' (N)' : null) })
            .button({ key: keys.rotate_mode,
                      id: 'rotate-mode-menu-button',
                      text: 'Rotate mode',
                      key_text: (enable_keys ? ' (R)' : null) })
            .button({ key: keys.text_mode,
                      id: 'text-mode-menu-button',
                      text: 'Text mode',
                      key_text: (enable_keys ? ' (T)' : null) })
            .divider()
            .button({ key: keys.delete,
                      text: 'Delete',
                      key_text: (enable_keys ? ' (Del)' : null) })
            .button({ key: keys.undo,
                      text: 'Undo',
                      key_text: (enable_keys ? ' (Ctrl+Z)' : null) })
            .button({ key: keys.redo,
                      text: 'Redo',
                      key_text: (enable_keys ? ' (Ctrl+Shift+Z)' : null) })
            .button({ key: keys.toggle_primary,
                      text: 'Toggle primary/secondary',
                      key_text: (enable_keys ? ' (P)' : null) })
            .button({ key: keys.cycle_primary,
                      text: 'Rotate reactant locations',
                      key_text: (enable_keys ? ' (C)' : null) })
            .button({ key: keys.select_all,
                      text: 'Select all',
                      key_text: (enable_keys ? ' (Ctrl+A)' : null) })
            .button({ key: keys.select_none,
                      text: 'Select none',
                      key_text: (enable_keys ? ' (Ctrl+Shift+A)' : null) })
            .button({ key: keys.invert_selection,
                      text: 'Invert selection' })
    } else {
        edit_menu.button({ key: keys.view_mode,
                           id: 'view-mode-menu-button',
                           text: 'View mode' })
    }

    // view dropdown
    var view_menu = ui.dropdown_menu(menu, 'View', true)
            .button({ key: keys.zoom_in,
                      text: 'Zoom in',
                      key_text: (enable_keys ? ' (Ctrl and +)' : null) })
            .button({ key: keys.zoom_out,
                      text: 'Zoom out',
                      key_text: (enable_keys ? ' (Ctrl and -)' : null) })
            .button({ key: keys.extent_nodes,
                      text: 'Zoom to nodes',
                      key_text: (enable_keys ? ' (Ctrl+0)' : null) })
            .button({ key: keys.extent_canvas,
                      text: 'Zoom to canvas',
                      key_text: (enable_keys ? ' (Ctrl+1)' : null) })
            .button({ key: keys.search,
                      text: 'Find',
                      key_text: (enable_keys ? ' (Ctrl+F)' : null) })
    if (full_screen_button) {
        view_menu.button({ key: keys.full_screen,
                           text: 'Full screen',
                           key_text: (enable_keys ? ' (Ctrl+2)' : null) })
    }
    if (enable_editing) {
        view_menu.button({ key: keys.toggle_beziers,
                           id: 'bezier-button',
                           text: 'Show control points',
                           key_text: (enable_keys ? ' (B)' : null) })
        map.callback_manager
            .set('toggle_beziers.button', function(on_off) {
                menu.select('#bezier-button').select('.dropdown-button-text')
                    .text((on_off ? 'Hide' : 'Show') +
                          ' control points' +
                          (enable_keys ? ' (B)' : ''))
            })
    }
    view_menu.divider()
        .button({ key: keys.show_settings,
                  text: 'Settings',
                  key_text: (enable_keys ? ' (Ctrl+,)' : null) })

    // help
    menu.append('a')
        .attr('class', 'help-button')
        .attr('target', '#')
        .attr('href', 'https://escher.readthedocs.org')
        .text('?')

    // set up mode callbacks
    var select_button = function(id) {
        // toggle the button
        $(this.selection.node()).find('#' + id)
            .button('toggle')

        // menu buttons
        var ids = ['zoom-mode-menu-button', 'brush-mode-menu-button',
                   'build-mode-menu-button', 'rotate-mode-menu-button',
                   'view-mode-menu-button', 'text-mode-menu-button']
        ids.forEach(function(this_id) {
            var b_id = this_id.replace('-menu', '')
            this.selection.select('#' + this_id)
                .select('span')
                .classed('glyphicon', b_id == id)
                .classed('glyphicon-ok', b_id == id)
        }.bind(this))
    }
    this.callback_manager.set('zoom_mode', select_button.bind(this, 'zoom-mode-button'))
    this.callback_manager.set('brush_mode', select_button.bind(this, 'brush-mode-button'))
    this.callback_manager.set('build_mode', select_button.bind(this, 'build-mode-button'))
    this.callback_manager.set('rotate_mode', select_button.bind(this, 'rotate-mode-button'))
    this.callback_manager.set('view_mode', select_button.bind(this, 'view-mode-button'))
    this.callback_manager.set('text_mode', select_button.bind(this, 'text-mode-button'))

    // definitions
    function load_map_for_file(error, map_data) {
        /** Load a map. This reloads the whole builder. */
        if (error) {
            console.warn(error)
            this.map.set_status('Error loading map: ' + error, 2000)
            return
        }

        try {
            check_map(map_data)
            this.load_map(map_data)
            this.map.set_status('Loaded map ' + map_data[0].map_name, 3000)
        } catch (e) {
            console.warn(e)
            this.map.set_status('Error loading map: ' + e, 2000)
        }

        // definitions
        function check_map(data) {
            /** Perform a quick check to make sure the map is mostly valid.

             */

            if (!('map_id' in data[0] && 'reactions' in data[1] &&
                  'nodes' in data[1] && 'canvas' in data[1]))
                throw new Error('Bad map data.')
        }
    }
    function load_model_for_file(error, data) {
        /** Load a cobra model. Redraws the whole map if the
         highlight_missing option is true.

         */
        if (error) {
            console.warn(error)
            this.map.set_status('Error loading model: ' + error, 2000)
            return
        }

        try {
            this.load_model(data, true)
            this.build_input.toggle(false)
            if ('id' in data)
                this.map.set_status('Loaded model ' + data.id, 3000)
            else
                this.map.set_status('Loaded model (no model id)', 3000)
        } catch (e) {
            console.warn(e)
            this.map.set_status('Error loading model: ' + e, 2000)
        }

    }
    function load_reaction_data_for_file(error, data) {
        if (error) {
            console.warn(error)
            this.map.set_status('Could not parse file as JSON or CSV', 2000)
            return
        }
        // turn off gene data
        if (data !== null)
            this.set_gene_data(null)

        this.set_reaction_data(data)
    }
    function load_metabolite_data_for_file(error, data) {
        if (error) {
            console.warn(error)
            this.map.set_status('Could not parse file as JSON or CSV', 2000)
            return
        }
        this.set_metabolite_data(data)
    }
    function load_gene_data_for_file(error, data) {
        if (error) {
            console.warn(error)
            this.map.set_status('Could not parse file as JSON or CSV', 2000)
            return
        }
        // turn off reaction data
        if (data !== null)
            this.set_reaction_data(null)

        // turn on gene_reaction_rules
        this.settings.set_conditional('show_gene_reaction_rules', true)

        this.set_gene_data(data)
    }
}

function _set_up_button_panel(button_selection, keys, enable_editing,
                              enable_keys, full_screen_button, menu_option,
                              ignore_bootstrap) {
    var button_panel = button_selection.append('ul')
            .attr('class', 'nav nav-pills nav-stacked')
            .attr('id', 'button-panel')

    // buttons
    ui.individual_button(button_panel.append('li'),
                         { key: keys.zoom_in,
                           text: '+',
                           icon: 'glyphicon glyphicon-plus-sign',
                           tooltip: 'Zoom in',
                           key_text: (enable_keys ? ' (Ctrl and +)' : null),
                           ignore_bootstrap: ignore_bootstrap })
    ui.individual_button(button_panel.append('li'),
                         { key: keys.zoom_out,
                           text: '–',
                           icon: 'glyphicon glyphicon-minus-sign',
                           tooltip: 'Zoom out',
                           key_text: (enable_keys ? ' (Ctrl and -)' : null),
                           ignore_bootstrap: ignore_bootstrap  })
    ui.individual_button(button_panel.append('li'),
                         { key: keys.extent_canvas,
                           text: '↔',
                           icon: 'glyphicon glyphicon-resize-full',
                           tooltip: 'Zoom to canvas',
                           key_text: (enable_keys ? ' (Ctrl+1)' : null),
                           ignore_bootstrap: ignore_bootstrap  })
    if (full_screen_button) {
        ui.individual_button(button_panel.append('li'),
            {   key: keys.full_screen,
                text: '▣',
                icon: 'glyphicon glyphicon-fullscreen',
                tooltip: 'Full screen',
                key_text: (enable_keys ? ' (Ctrl+2)' : null),
                ignore_bootstrap: ignore_bootstrap
            })
    }

    // mode buttons
    if (enable_editing && menu_option === 'all') {
        ui.radio_button_group(button_panel.append('li'))
            .button({ key: keys.zoom_mode,
                      id: 'zoom-mode-button',
                      text: 'Z',
                      icon: 'glyphicon glyphicon-move',
                      tooltip: 'Pan mode',
                      key_text: (enable_keys ? ' (Z)' : null),
                      ignore_bootstrap: ignore_bootstrap  })
            .button({ key: keys.brush_mode,
                      text: 'V',
                      id: 'brush-mode-button',
                      icon: 'glyphicon glyphicon-hand-up',
                      tooltip: 'Select mode',
                      key_text: (enable_keys ? ' (V)' : null),
                      ignore_bootstrap: ignore_bootstrap  })
            .button({ key: keys.build_mode,
                      text: 'N',
                      id: 'build-mode-button',
                      icon: 'glyphicon glyphicon-plus',
                      tooltip: 'Add reaction mode',
                      key_text: (enable_keys ? ' (N)' : null),
                      ignore_bootstrap: ignore_bootstrap  })
            .button({ key: keys.rotate_mode,
                      text: 'R',
                      id: 'rotate-mode-button',
                      icon: 'glyphicon glyphicon-repeat',
                      tooltip: 'Rotate mode',
                      key_text: (enable_keys ? ' (R)' : null),
                      ignore_bootstrap: ignore_bootstrap  })
            .button({ key: keys.text_mode,
                      text: 'T',
                      id: 'text-mode-button',
                      icon: 'glyphicon glyphicon-font',
                      tooltip: 'Text mode',
                      key_text: (enable_keys ? ' (T)' : null),
                      ignore_bootstrap: ignore_bootstrap  })

        // arrow buttons
        this.direction_buttons = button_panel.append('li')
        var o = ui.button_group(this.direction_buttons)
                .button({ key: keys.direction_arrow_left,
                          text: '←',
                          icon: 'glyphicon glyphicon-arrow-left',
                          tooltip: 'Direction arrow (←)',
                          ignore_bootstrap: ignore_bootstrap  })
                .button({ key: keys.direction_arrow_right,
                          text: '→',
                          icon: 'glyphicon glyphicon-arrow-right',
                          tooltip: 'Direction arrow (→)',
                          ignore_bootstrap: ignore_bootstrap  })
                .button({ key: keys.direction_arrow_up,
                          text: '↑',
                          icon: 'glyphicon glyphicon-arrow-up',
                          tooltip: 'Direction arrow (↑)',
                          ignore_bootstrap: ignore_bootstrap  })
                .button({ key: keys.direction_arrow_down,
                          text: '↓',
                          icon: 'glyphicon glyphicon-arrow-down',
                          tooltip: 'Direction arrow (↓)',
                          ignore_bootstrap: ignore_bootstrap  })
    }
}

function _toggle_direction_buttons(on_off) {
    if (_.isUndefined(on_off))
        on_off = !this.direction_buttons.style('display') === 'block'
    this.direction_buttons.style('display', on_off ? 'block' : 'none')
}

function _setup_status(selection, map) {
    var status_bar = selection.append('div').attr('id', 'status');
    map.callback_manager.set('set_status', function(status) {
        status_bar.html(status);
    });
    return status_bar;
}

function _setup_quick_jump(selection) {
    // function to load a map
    var load_fn = function(new_map_name, quick_jump_path, callback) {
        if (this.options.enable_editing && !this.options.never_ask_before_quit) {
            if (!(confirm(('You will lose any unsaved changes.\n\n' +
                           'Are you sure you want to switch maps?')))) {
                if (callback) callback(false)
                return
            }
        }
        this.map.set_status('Loading map ' + new_map_name + ' ...');
        var url = utils.name_to_url(new_map_name, quick_jump_path);
        d3.json(url, function(error, data) {
            if (error) {
                console.warn('Could not load data: ' + error)
                this.map.set_status('Could not load map', 2000)
                if (callback) callback(false)
                return
            }
            // run callback before load_map so the new map has the correct
            // quick_jump menu
            if (callback) callback(true)
            // now reload
            this.load_map(data)
            this.map.set_status('')
        }.bind(this))
    }.bind(this)

    // make the quick jump object
    this.quick_jump = QuickJump(selection, load_fn)
}

function _setup_modes (map, brush, zoom_container) {
  // set up zoom+pan and brush modes
  var was_enabled = {}
  map.callback_manager.set('start_rotation', function () {
    was_enabled.brush = brush.enabled
    brush.toggle(false)
    was_enabled.zoom = zoom_container.zoom_on
    zoom_container.toggle_pan_drag(false)
    was_enabled.selectable_mousedown = map.behavior.selectable_mousedown !== null
    map.behavior.toggle_selectable_click(false)
    was_enabled.label_mouseover = map.behavior.label_mouseover !== null
    map.behavior.toggle_label_mouseover(false)
  })
  map.callback_manager.set('end_rotation', function () {
    brush.toggle(was_enabled.brush)
    zoom_container.toggle_pan_drag(was_enabled.zoom)
    map.behavior.toggle_selectable_click(was_enabled.selectable_mousedown)
    map.behavior.toggle_label_mouseover(was_enabled.label_mouseover)
    was_enabled = {}
  })
}

function _get_keys(map, zoom_container, search_bar, settings_bar, enable_editing, full_screen_button) {

        var keys = {
        save: {
            key: 'ctrl+s',
            target: map,
            fn: map.save
        },
        save_svg: {
            key: 'ctrl+shift+s',
            target: map,
            fn: map.save_svg
        },
        save_png: {
            key: 'ctrl+shift+p',
            target: map,
            fn: map.save_png
        },
        load: {
            key: 'ctrl+o',
            fn: null  // defined by button
        },
        convert_map: {
            target: map,
            fn: map.convert_map
        },
        clear_map: {
            target: map,
            fn: map.clear_map
        },
        load_model: {
            key: 'ctrl+m',
            fn: null // defined by button
        },
        clear_model: {
            fn: this.load_model.bind(this, null, true)
        },
        load_reaction_data: { fn: null }, // defined by button
        clear_reaction_data: {
            target: this,
            fn: function() { this.set_reaction_data(null); }
        },
        load_metabolite_data: { fn: null }, // defined by button
        clear_metabolite_data: {
            target: this,
            fn: function() { this.set_metabolite_data(null); }
        },
        load_gene_data: { fn: null }, // defined by button
        clear_gene_data: {
            target: this,
            fn: function() { this.set_gene_data(null, true); }
        },
        zoom_in: {
            key: 'ctrl+=',
            target: zoom_container,
            fn: zoom_container.zoom_in
        },
        zoom_out: {
            key: 'ctrl+-',
            target: zoom_container,
            fn: zoom_container.zoom_out
        },
        extent_nodes: {
            key: 'ctrl+0',
            target: map,
            fn: map.zoom_extent_nodes
        },
        extent_canvas: {
            key: 'ctrl+1',
            target: map,
            fn: map.zoom_extent_canvas
        },
        search: {
            key: 'ctrl+f',
            fn: search_bar.toggle.bind(search_bar, true)
        },
        view_mode: {
            target: this,
            fn: this.view_mode,
            ignore_with_input: true
        },
        show_settings: {
            key: 'ctrl+,',
            target: settings_bar,
            fn: settings_bar.toggle
        }
    };
    if (full_screen_button) {
        utils.extend(keys, {
            full_screen: {
                key: 'ctrl+2',
                target: map,
                fn: map.full_screen
            }
        })
    }
    if (enable_editing) {
        utils.extend(keys, {
            build_mode: {
                key: 'n',
                target: this,
                fn: this.build_mode,
                ignore_with_input: true
            },
            zoom_mode: {
                key: 'z',
                target: this,
                fn: this.zoom_mode,
                ignore_with_input: true
            },
            brush_mode: {
                key: 'v',
                target: this,
                fn: this.brush_mode,
                ignore_with_input: true
            },
            rotate_mode: {
                key: 'r',
                target: this,
                fn: this.rotate_mode,
                ignore_with_input: true
            },
            text_mode: {
                key: 't',
                target: this,
                fn: this.text_mode,
                ignore_with_input: true
            },
            toggle_beziers: {
                key: 'b',
                target: map,
                fn: map.toggle_beziers,
                ignore_with_input: true
            },
            delete: {
                key: 'ctrl+backspace',
                target: map,
                fn: map.delete_selected,
                ignore_with_input: true
            },
            delete_del: {
                key: 'del',
                target: map,
                fn: map.delete_selected,
                ignore_with_input: true
            },
            toggle_primary: {
                key: 'p',
                target: map,
                fn: map.toggle_selected_node_primary,
                ignore_with_input: true
            },
            cycle_primary: {
                key: 'c',
                target: map,
                fn: map.cycle_primary_node,
                ignore_with_input: true
            },
            direction_arrow_right: {
                key: 'right',
                target: this.build_input.direction_arrow,
                fn: this.build_input.direction_arrow.right,
                ignore_with_input: true
            },
            direction_arrow_down: {
                key: 'down',
                target: this.build_input.direction_arrow,
                fn: this.build_input.direction_arrow.down,
                ignore_with_input: true
            },
            direction_arrow_left: {
                key: 'left',
                target: this.build_input.direction_arrow,
                fn: this.build_input.direction_arrow.left,
                ignore_with_input: true
            },
            direction_arrow_up: {
                key: 'up',
                target: this.build_input.direction_arrow,
                fn: this.build_input.direction_arrow.up,
                ignore_with_input: true
            },
            undo: {
                key: 'ctrl+z',
                target: map.undo_stack,
                fn: map.undo_stack.undo
            },
            redo: {
                key: 'ctrl+shift+z',
                target: map.undo_stack,
                fn: map.undo_stack.redo
            },
            select_all: {
                key: 'ctrl+a',
                target: map,
                fn: map.select_all
            },
            select_none: {
                key: 'ctrl+shift+a',
                target: map,
                fn: map.select_none
            },
            invert_selection: {
                target: map,
                fn: map.invert_selection
            }
        });
    }
    return keys;
}

function _setup_confirm_before_exit() {
    /** Ask if the user wants to exit the page (to avoid unplanned refresh).

     */

    window.onbeforeunload = function(e) {
        // If we haven't been passed the event get the window.event
        e = e || window.event;
        return  (this.options.never_ask_before_quit ? null :
                 'You will lose any unsaved changes.');
    }.bind(this);
}

},{"./Brush":2,"./BuildInput":3,"./CallbackManager":5,"./CobraModel":7,"./Map":12,"./QuickJump":14,"./SearchBar":17,"./Settings":19,"./SettingsMenu":20,"./TextEditInput":21,"./Tooltip":22,"./TooltipContainer":23,"./ZoomContainer":25,"./data_styles":28,"./inline":29,"./ui":32,"./utils":33,"underscore":38}],5:[function(require,module,exports){
/** CallbackManager */

var utils = require('./utils');
var _ = require('underscore');


var CallbackManager = utils.make_class();
CallbackManager.prototype = {
    init: init,
    set: set,
    remove: remove,
    run: run
};
module.exports = CallbackManager;


function init() {

}


function set(name, fn) {
    /** As in d3 callbacks, you can namespace your callbacks after a period:

     select_metabolite.direction_arrow
     select_metabolite.input

     Both are called by select_metabolite


     TODO add *arguments to set, as in _.defer()

     */
    if (this.callbacks===undefined) this.callbacks = {};
    if (this.callbacks[name]===undefined) this.callbacks[name] = [];
    this.callbacks[name].push(fn);

    return this;
}


function remove(name) {
    /** Remove a callback by name

     */
    if (this.callbacks===undefined || Object.keys(this.callbacks).length==0) {
        console.warn('No callbacks to remove');
    }
    delete this.callbacks[name];
    return this;
}


function run(name, this_arg) {
    /** Run all callbacks that match the portion of name before the period ('.').

     Arguments
     ---------

     name: The callback name, which can include a tag after a '.' to
     specificy a particular callback.

     this_arg: (Optional, Default: null) The object assigned to `this` in
     the callback.

     */
    if (_.isUndefined(this.callbacks)) return this;
    if (_.isUndefined(this_arg)) this_arg = null;
    // pass all but the first (name) argument to the callback
    var pass_args = Array.prototype.slice.call(arguments, 2);
    // look for matching callback names
    for (var a_name in this.callbacks) {
        var split_name = a_name.split('.')[0];
        if (split_name==name) {
            this.callbacks[a_name].forEach(function(fn) {
                fn.apply(this_arg, pass_args);
            });
        }
    }
    return this;
}

},{"./utils":33,"underscore":38}],6:[function(require,module,exports){
/** Canvas. Defines a canvas that accepts drag/zoom events and can be resized.

 Canvas(selection, x, y, width, height)

 Adapted from http://bl.ocks.org/mccannf/1629464.

 */

/* global d3 */

var utils = require('./utils');
var CallbackManager = require('./CallbackManager');


var Canvas = utils.make_class();
Canvas.prototype = {
    init: init,
    toggle_resize: toggle_resize,
    setup: setup,
    size_and_location: size_and_location
};
module.exports = Canvas;


function init(selection, size_and_location) {
    this.selection = selection;
    this.x = size_and_location.x;
    this.y = size_and_location.y;
    this.width = size_and_location.width;
    this.height = size_and_location.height;

    // enable by default
    this.resize_enabled = true;

    // set up the callbacks
    this.callback_manager = new CallbackManager();

    this.setup();
}

function toggle_resize(on_off) {
    /** Turn the resize on or off

     */
    if (on_off===undefined) on_off = !this.resize_enabled;

    if (on_off) {
        this.selection.selectAll('.drag-rect')
            .style('pointer-events', 'auto');
    } else {
        this.selection.selectAll('.drag-rect')
            .style('pointer-events', 'none');
    }
}

function setup() {
    var self = this,
        extent = {"x": this.width, "y": this.height},
        dragbar_width = 100,
        mouse_node_mult = 10,
        new_sel = this.selection.append('g')
            .classed('canvas-group', true)
            .data([{x: this.x, y: this.y}]);

    var mouse_node = new_sel.append('rect')
            .attr('id', 'mouse-node')
            .attr("width", this.width*mouse_node_mult)
            .attr("height", this.height*mouse_node_mult)
            .attr("transform", "translate("+[self.x - this.width*mouse_node_mult/2,
                                             self.y - this.height*mouse_node_mult/2]+")")
            .attr('pointer-events', 'all');
    this.mouse_node = mouse_node;

    var rect = new_sel.append('rect')
            .attr('id', 'canvas')
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("transform", "translate("+[self.x, self.y]+")");

    var drag_right = d3.behavior.drag()
            .origin(Object)
            .on("dragstart", stop_propagation)
            .on("drag", rdragresize),
        drag_left = d3.behavior.drag()
            .origin(Object)
            .on("dragstart", stop_propagation)
            .on("drag", ldragresize),
        drag_top = d3.behavior.drag()
            .origin(Object)
            .on("dragstart", stop_propagation)
            .on("drag", tdragresize),
        drag_bottom = d3.behavior.drag()
            .origin(Object)
            .on("dragstart", stop_propagation)
            .on("drag", bdragresize);

    var left = new_sel.append("rect")
            .classed('drag-rect', true)
            .attr('transform', function(d) {
                return 'translate('+[ d.x - (dragbar_width/2),
                                      d.y + (dragbar_width/2) ]+')';
            })
            .attr("height", this.height - dragbar_width)
            .attr("id", "dragleft")
            .attr("width", dragbar_width)
            .attr("cursor", "ew-resize")
            .classed('resize-rect', true)
            .call(drag_left);

    var right = new_sel.append("rect")
            .classed('drag-rect', true)
            .attr('transform', function(d) {
                return 'translate('+[ d.x + self.width - (dragbar_width/2),
                                      d.y + (dragbar_width/2) ]+')';
            })
            .attr("id", "dragright")
            .attr("height", this.height - dragbar_width)
            .attr("width", dragbar_width)
            .attr("cursor", "ew-resize")
            .classed('resize-rect', true)
            .call(drag_right);

    var top = new_sel.append("rect")
            .classed('drag-rect', true)
            .attr('transform', function(d) {
                return 'translate('+[ d.x + (dragbar_width/2),
                                      d.y - (dragbar_width/2) ]+')';
            })
            .attr("height", dragbar_width)
            .attr("id", "dragtop")
            .attr("width", this.width - dragbar_width)
            .attr("cursor", "ns-resize")
            .classed('resize-rect', true)
            .call(drag_top);

    var bottom = new_sel.append("rect")
            .classed('drag-rect', true)
            .attr('transform', function(d) {
                return 'translate('+[ d.x + (dragbar_width/2),
                                      d.y + self.height - (dragbar_width/2) ]+')';
            })
            .attr("id", "dragbottom")
            .attr("height", dragbar_width)
            .attr("width", this.width - dragbar_width)
            .attr("cursor", "ns-resize")
            .classed('resize-rect', true)
            .call(drag_bottom);

    // definitions
    function stop_propagation() {
        d3.event.sourceEvent.stopPropagation();
    }
    function transform_string(x, y, current_transform) {
        var tr = utils.d3_transform_catch(current_transform),
            translate = tr.translate;
        if (x!==null) translate[0] = x;
        if (y!==null) translate[1] = y;
        return 'translate('+translate+')';
    }
    function ldragresize(d) {
        var oldx = d.x;
        d.x = Math.min(d.x + self.width - (dragbar_width / 2), d3.event.x);
        self.x = d.x;
        self.width = self.width + (oldx - d.x);
        left.attr("transform", function(d) {
            return transform_string(d.x - (dragbar_width / 2), null, left.attr('transform'));
        });
        mouse_node.attr("transform", function(d) {
            return transform_string(d.x, null, mouse_node.attr('transform'));
        }).attr("width", self.width*mouse_node_mult);
        rect.attr("transform", function(d) {
            return transform_string(d.x, null, rect.attr('transform'));
        }).attr("width", self.width);
        top.attr("transform", function(d) {
            return transform_string(d.x + (dragbar_width/2), null, top.attr('transform'));
        }).attr("width", self.width - dragbar_width);
        bottom.attr("transform", function(d) {
            return transform_string(d.x + (dragbar_width/2), null, bottom.attr('transform'));
        }).attr("width", self.width - dragbar_width);

        self.callback_manager.run('resize');
    }

    function rdragresize(d) {
        d3.event.sourceEvent.stopPropagation();
        var dragx = Math.max(d.x + (dragbar_width/2), d.x + self.width + d3.event.dx);
        //recalculate width
        self.width = dragx - d.x;
        //move the right drag handle
        right.attr("transform", function(d) {
            return transform_string(dragx - (dragbar_width/2), null, right.attr('transform'));
        });
        //resize the drag rectangle
        //as we are only resizing from the right, the x coordinate does not need to change
        mouse_node.attr("width", self.width*mouse_node_mult);
        rect.attr("width", self.width);
        top.attr("width", self.width - dragbar_width);
        bottom.attr("width", self.width - dragbar_width);

        self.callback_manager.run('resize');
    }

    function tdragresize(d) {
        d3.event.sourceEvent.stopPropagation();
        var oldy = d.y;
        d.y = Math.min(d.y + self.height - (dragbar_width / 2), d3.event.y);
        self.y = d.y;
        self.height = self.height + (oldy - d.y);
        top.attr("transform", function(d) {
            return transform_string(null, d.y - (dragbar_width / 2), top.attr('transform'));
        });
        mouse_node.attr("transform", function(d) {
            return transform_string(null, d.y, mouse_node.attr('transform'));
        }).attr("width", self.height*mouse_node_mult);
        rect.attr("transform", function(d) {
            return transform_string(null, d.y, rect.attr('transform'));
        }).attr("height", self.height);
        left.attr("transform", function(d) {
            return transform_string(null, d.y + (dragbar_width/2), left.attr('transform'));
        }).attr("height", self.height - dragbar_width);
        right.attr("transform", function(d) {
            return transform_string(null, d.y + (dragbar_width/2), right.attr('transform'));
        }).attr("height", self.height - dragbar_width);

        self.callback_manager.run('resize');
    }

    function bdragresize(d) {
        d3.event.sourceEvent.stopPropagation();
        var dragy = Math.max(d.y + (dragbar_width/2), d.y + self.height + d3.event.dy);
        //recalculate width
        self.height = dragy - d.y;
        //move the right drag handle
        bottom.attr("transform", function(d) {
            return transform_string(null, dragy - (dragbar_width/2), bottom.attr('transform'));
        });
        //resize the drag rectangle
        //as we are only resizing from the right, the x coordinate does not need to change
        mouse_node.attr("height", self.height*mouse_node_mult);
        rect.attr("height", self.height);
        left.attr("height", self.height - dragbar_width);
        right.attr("height", self.height - dragbar_width);

        self.callback_manager.run('resize');
    }
}

function size_and_location() {
    return { x: this.x,
             y: this.y,
             width: this.width,
             height: this.height };
}

},{"./CallbackManager":5,"./utils":33}],7:[function(require,module,exports){
/** CobraModel
 *
 */

var utils = require('./utils')
var data_styles = require('./data_styles')

var CobraModel = utils.make_class()
// class methods
CobraModel.from_cobra_json = from_cobra_json
CobraModel.build_reaction_string = build_reaction_string
// instance methods
CobraModel.prototype = { init: init,
                         apply_reaction_data: apply_reaction_data,
                         apply_metabolite_data: apply_metabolite_data,
                         apply_gene_data: apply_gene_data,
                       }
module.exports = CobraModel

// class methods
function build_reaction_string(stoichiometries, is_reversible) {
    /** Return a reaction string for the given stoichiometries.

     Adapted from cobra.core.Reaction.build_reaction_string().

     Arguments
     ---------

     stoichiometries: An object with metabolites as keys and
     stoichiometries as values.

     is_reversible: Boolean. Whether the reaction is reversible.

     */

    var format = function(number) {
        if (number == 1)
            return ""
        return String(number) + " "
    }
    var reactant_dict = {},
        product_dict = {},
        reactant_bits = [],
        product_bits = []
    for (var the_metabolite in stoichiometries) {
        var coefficient = stoichiometries[the_metabolite]
        if (coefficient > 0)
            product_bits.push(format(coefficient) + the_metabolite)
        else
            reactant_bits.push(format(Math.abs(coefficient)) + the_metabolite)
    }
    var reaction_string = reactant_bits.join(' + ')
    if (is_reversible) {
        reaction_string += ' ↔ '
    } else {
        reaction_string += ' → '
    }
    reaction_string += product_bits.join(' + ')
    return reaction_string
}

function from_cobra_json(model_data) {
    /** Use a JSON Cobra model exported by COBRApy to make a new CobraModel
     object.

     The COBRA "id" becomes a "bigg_id", and "upper_bound" and "lower_bound"
     bounds become "reversibility".

     Fills out a "genes" list.

     */
    // reactions and metabolites
    if (!(model_data.reactions && model_data.metabolites))
        throw new Error('Bad model data.')

    // make a gene dictionary
    var genes = {}
    for (var i = 0, l = model_data.genes.length; i < l; i++) {
        var r = model_data.genes[i],
            the_id = r.id
        genes[the_id] = r
    }

    var model = new CobraModel()

    model.reactions = {}
    for (var i = 0, l = model_data.reactions.length; i<l; i++) {
        var r = model_data.reactions[i],
            the_id = r.id,
            reaction = utils.clone(r)
        delete reaction.id
        reaction.bigg_id = the_id
        // add the appropriate genes
        reaction.genes = []

        // set reversibility
        reaction.reversibility = (reaction.lower_bound < 0 && reaction.upper_bound > 0)
        if (reaction.upper_bound <= 0 && reaction.lower_bound < 0) {
            // reverse stoichiometries
            for (var met_id in reaction.metabolites) {
                reaction.metabolites[met_id] = -reaction.metabolites[met_id]
            }
        }
        delete reaction.lower_bound
        delete reaction.upper_bound

        if ('gene_reaction_rule' in reaction) {
            var gene_ids = data_styles.genes_for_gene_reaction_rule(reaction.gene_reaction_rule)
            gene_ids.forEach(function(gene_id) {
                if (gene_id in genes) {
                    var gene = utils.clone(genes[gene_id])
                    // rename id to bigg_id
                    gene.bigg_id = gene.id
                    delete gene.id
                    reaction.genes.push(gene)
                } else {
                    console.warn('Could not find gene for gene_id ' + gene_id)
                }
            })
        }
        model.reactions[the_id] = reaction
    }
    model.metabolites = {}
    for (var i=0, l=model_data.metabolites.length; i<l; i++) {
        var r = model_data.metabolites[i],
            the_id = r.id,
            met = utils.clone(r)
        delete met.id
        met.bigg_id = the_id
        model.metabolites[the_id] = met
    }
    return model
}

// instance methods
function init() {
  this.reactions = {}
  this.metabolites = {}
}

function apply_reaction_data(reaction_data, styles, compare_style) {
    /** Apply data to model. This is only used to display options in
     BuildInput.

     apply_reaction_data overrides apply_gene_data.

     */
    data_styles.apply_reaction_data_to_reactions(this.reactions, reaction_data,
                                                 styles, compare_style)
}

function apply_metabolite_data(metabolite_data, styles, compare_style) {
    /** Apply data to model. This is only used to display options in
     BuildInput.

     */
    data_styles.apply_metabolite_data_to_nodes(this.metabolites, metabolite_data,
                                               styles, compare_style)
}

/**
 * Apply data to model. This is only used to display options in
 * BuildInput. Overrides apply_reaction_data.
 */
function apply_gene_data (gene_data_obj, styles, identifiers_on_map,
                         compare_style, and_method_in_gene_reaction_rule) {
    data_styles.apply_gene_data_to_reactions(this.reactions, gene_data_obj,
                                             styles, identifiers_on_map,
                                             compare_style,
                                             and_method_in_gene_reaction_rule)
}

},{"./data_styles":28,"./utils":33}],8:[function(require,module,exports){
/** DataMenu */

/* global d3 */

var utils = require('./utils');


module.exports = function(options) {
    var o = utils.set_options(options, {
        selection: null,
        getdatafiles: null,
        datafiles: null,
        update_callback: null,
        target: null});

    if (o.selection===null)
        throw new Error('No selection provided for DataMenu');

    // setup dropdown menu
    // Append menu if it doesn't exist
    var menu = o.selection.select('.data-menu');
    if (menu.empty()) {
        menu = o.selection.append('div')
            .attr('class','data-menu');
    }
    var select_sel = menu.append('form')
            .append('select').attr('class','dropdown-menu');

    if (o.getdatafiles) {
        if (o.datafiles) {
            console.warn('DataMenu: getdatafiles option overrides datafiles');
        }
        d3.json(o.getdatafiles, function(error, d) {
            // returns json object:  { data: [file0, file1, ...] }
            if (error) {
                return console.warn(error);
            } else {
                load_with_files(o.target, d.data, select_sel, o.update_callback, o.selection);
            }
            return null;
        });
    } else if (o.datafiles) {
        load_with_files(o.target, o.datafiles, select_sel, o.update_callback, o.selection);
    } else {
        console.warn('DataMenu: No datafiles given');
    }

    return { update: update };

    // definitions
    function load_with_files(t, files, select_sel, update_callback, selection) {

        //when it changes
        select_sel.node().addEventListener("change", function() {
            load_datafile(t, this.value, selection, update_callback);
        }, false);

        var file = files[0];

        update(files, select_sel);
        load_datafile(t, file, selection, update_callback);
    };
    function load_datafile(t, this_file, selection, callback) {
        utils.load_the_file(t, this_file, function(error, data) {
            if (error) {
                return console.warn(error);
                selection.append('error loading');
                o.data = null;
            } else {
                o.data = data;
                if (callback) {
                    callback(data);
                }
            }
        });
    };

    function update(list, select_sel) {
        // update select element with d3 selection /select_sel/ to have options
        // given by /list/
        // TODO remove paths from file list
        select_sel.selectAll(".menu-option")
            .data(list)
            .enter()
            .append('option')
            .attr('value', function (d) { return d; } )
            .text(function (d) { return d; } );
        // TODO set value to default_filename_index
        select_sel.node().focus();
    };

    function get_data() {
        return o.data;
    };
};

},{"./utils":33}],9:[function(require,module,exports){
/** DirectionArrow. A constructor for an arrow that can be rotated and dragged,
 and supplies its direction. */

/* global d3 */

var utils = require('./utils');


var DirectionArrow = utils.make_class();
DirectionArrow.prototype = {
    init: init,
    set_location: set_location,
    set_rotation: set_rotation,
    displace_rotation: displace_rotation,
    get_rotation: get_rotation,
    toggle: toggle,
    show: show,
    hide: hide,
    right: right,
    left: left,
    up: up,
    down: down,
    _setup_drag: _setup_drag
};
module.exports = DirectionArrow;


// definitions
function init(sel) {
    this.arrow_container = sel.append('g')
        .attr('id', 'direction-arrow-container')
        .attr('transform', 'translate(0,0)rotate(0)');
    this.arrow = this.arrow_container.append('path')
        .classed('direction-arrow', true)
        .attr('d', path_for_arrow())
        .style('visibility', 'hidden')
        .attr('transform', 'translate(30,0)scale(2.5)');

    this.sel = sel;
    this.center = { x: 0, y: 0 };

    this._setup_drag();
    this.dragging = false;

    this.is_visible = false;
    this.show();

    // definitions
    function path_for_arrow() {
        return "M0 -5 L0 5 L20 5 L20 10 L30 0 L20 -10 L20 -5 Z";
    }
}
function set_location(coords) {
    /** Move the arrow to coords.
     */
    this.center = coords;
    var transform = utils.d3_transform_catch(this.arrow_container.attr('transform'));
    this.arrow_container.attr('transform',
                              'translate('+coords.x+','+coords.y+')rotate('+transform.rotate+')');
}
function set_rotation(rotation) {
    /** Rotate the arrow to rotation.
     */
    var transform = utils.d3_transform_catch(this.arrow_container.attr('transform'));
    this.arrow_container.attr('transform',
                              'translate('+transform.translate+')rotate('+rotation+')');
}
function displace_rotation(d_rotation) {
    /** Displace the arrow rotation by a set amount.
     */
    var transform = utils.d3_transform_catch(this.arrow_container.attr('transform'));
    this.arrow_container.attr('transform',
                              'translate('+transform.translate+')'+
                              'rotate('+(transform.rotate+d_rotation)+')');
}
function get_rotation() {
    /** Returns the arrow rotation.
     */
    return utils.d3_transform_catch(this.arrow_container.attr('transform')).rotate;
}
function toggle(on_off) {
    if (on_off===undefined) this.is_visible = !this.is_visible;
    else this.is_visible = on_off;
    this.arrow.style('visibility', this.is_visible ? 'visible' : 'hidden');
}
function show() {
    this.toggle(true);
}
function hide() {
    this.toggle(false);
}
function right() {
    this.set_rotation(0);
}
function down() {
    this.set_rotation(90);
}
function left() {
    this.set_rotation(180);
}
function up() {
    this.set_rotation(270);
}

function _setup_drag() {
    var b = d3.behavior.drag()
            .on("dragstart", function(d) {
                // silence other listeners
                d3.event.sourceEvent.stopPropagation();
                this.dragging = true;
            }.bind(this))
            .on("drag.direction_arrow", function(d) {
                var displacement = { x: d3.event.dx,
                                     y: d3.event.dy },
                    location = { x: d3.mouse(this.sel.node())[0],
                                 y: d3.mouse(this.sel.node())[1] },
                    d_angle = utils.angle_for_event(displacement,
                                                    location,
                                                    this.center);
                this.displace_rotation(utils.to_degrees(d_angle));
            }.bind(this))
            .on("dragend", function(d) {
                setTimeout(function() {
                    this.dragging = false;
                }.bind(this), 200);
            }.bind(this));
    this.arrow_container.call(b);
}

},{"./utils":33}],10:[function(require,module,exports){
/** Draw. Manages creating, updating, and removing objects during d3 data binding.

 Arguments
 ---------

 behavior: An escher.Behavior object.

 settings: An escher.Settings object.

 Callbacks
 ---------

 draw.callback_manager.run('create_membrane', draw, enter_selection);
 draw.callback_manager.run('update_membrane', draw, update_selection);
 draw.callback_manager.run('create_reaction', draw, enter_selection);
 draw.callback_manager.run('update_reaction', draw, update_selection);
 draw.callback_manager.run('create_reaction_label', draw, enter_selection);
 draw.callback_manager.run('update_reaction_label', draw, update_selection);
 draw.callback_manager.run('create_segment', draw, enter_selection);
 draw.callback_manager.run('update_segment', draw, update_selection);
 draw.callback_manager.run('create_bezier', draw, enter_selection);
 draw.callback_manager.run('update_bezier', draw, update_selection);
 draw.callback_manager.run('create_node', draw, enter_selection);
 draw.callback_manager.run('update_node', draw, update_selection);
 draw.callback_manager.run('create_text_label', draw, enter_selection);
 draw.callback_manager.run('update_text_label', draw, update_selection);

 */

/* global d3 */

var utils = require('./utils');
var data_styles = require('./data_styles');
var CallbackManager = require('./CallbackManager');


var Draw = utils.make_class();
// instance methods
Draw.prototype = {
    init: init,
    create_reaction: create_reaction,
    update_reaction: update_reaction,
    create_bezier: create_bezier,
    update_bezier: update_bezier,
    create_node: create_node,
    update_node: update_node,
    create_text_label: create_text_label,
    update_text_label: update_text_label,
    create_membrane: create_membrane,
    update_membrane: update_membrane,
    create_reaction_label: create_reaction_label,
    update_reaction_label: update_reaction_label,
    create_segment: create_segment,
    update_segment: update_segment
};
module.exports = Draw;

// definitions
function init(behavior, settings) {
    this.behavior = behavior;
    this.settings = settings;
    this.callback_manager = new CallbackManager();
}

function create_membrane(enter_selection) {
    enter_selection.append('rect')
        .attr('class', 'membrane');
    this.callback_manager.run('create_membrane', this, enter_selection);
}

function update_membrane(update_selection) {
    update_selection
        .attr('width', function(d){ return d.width; })
        .attr('height', function(d){ return d.height; })
        .attr('transform', function(d){return 'translate('+d.x+','+d.y+')';})
        .style('stroke-width', function(d) { return 10; })
        .attr('rx', function(d){ return 20; })
        .attr('ry', function(d){ return 20; });

    this.callback_manager.run('update_membrane', this, update_selection);
}

function create_reaction(enter_selection) {
    // attributes for new reaction group
    enter_selection.append('g')
        .attr('id', function(d) { return 'r'+d.reaction_id; })
        .attr('class', 'reaction')
        .call(this.create_reaction_label.bind(this));

    this.callback_manager.run('create_reaction', this, enter_selection);
    return;
}

function update_reaction(update_selection, scale, cobra_model, drawn_nodes,
                         defs, has_data_on_reactions) {
    /** Run on the update selection for reactions.

     Arguments
     ---------

     update_selection: The D3.js update selection.

     scale: A Scale object.

     cobra_model: A CobraModel object.

     drawn_nodes: The nodes object (e.g. Map.nodes).

     defs: The defs object generated by utils.setup_defs() (e.g. Map.defs).

     has_data_on_reactions: Boolean to determine whether data needs to be
     drawn.

     */

    // update reaction label
    update_selection.select('.reaction-label-group')
        .call(function(sel) {
            return this.update_reaction_label(sel, has_data_on_reactions);
        }.bind(this));

    // draw segments
    utils.draw_a_nested_object(update_selection, '.segment-group', 'segments', 'segment_id',
                               this.create_segment.bind(this),
                               function(sel) {
                                   return this.update_segment(sel, scale, cobra_model,
                                                              drawn_nodes, defs,
                                                              has_data_on_reactions);
                               }.bind(this),
                               function(sel) {
                                   sel.remove();
                               });

    // run the callback
    this.callback_manager.run('update_reaction', this, update_selection);
}

function create_reaction_label(enter_selection, tool) {
  /** Draw reaction label for selection.

   */

  var group = enter_selection.append('g')
        .attr('class', 'reaction-label-group')
  group.append('text')
    .attr('class', 'reaction-label label')
  group.append('g')
    .attr('class', 'all-genes-label-group')

  this.callback_manager.run('create_reaction_label', this, enter_selection);
}

/**
 * Run on the update selection for reaction labels.
 * @param {D3 Selection} update_selection - The D3.js update selection.
 * @param {Boolean} has_data_on_reactions - Whether data needs to be drawn.
 */
function update_reaction_label (update_selection, has_data_on_reactions) {
  var decimal_format = d3.format('.4g')
  var identifiers_on_map = this.settings.get_option('identifiers_on_map')
  var reaction_data_styles = this.settings.get_option('reaction_styles')
  var show_gene_reaction_rules = this.settings.get_option('show_gene_reaction_rules')
  var hide_all_labels = this.settings.get_option('hide_all_labels')
  var gene_font_size = this.settings.get_option('gene_font_size')
  var label_mousedown_fn = this.behavior.label_mousedown
  var label_mouseover_fn = this.behavior.label_mouseover
  var label_mouseout_fn = this.behavior.label_mouseout

  // label location
  update_selection
    .attr('transform', function(d) {
      return 'translate(' + d.label_x + ',' + d.label_y + ')'
    })
    .call(this.behavior.turn_off_drag)
    .call(this.behavior.reaction_label_drag)

  // update label visibility
  var label = update_selection.select('.reaction-label')
    .attr('visibility', hide_all_labels ? 'hidden' : 'visible')
  if (!hide_all_labels) {
    label
      .text(function(d) {
        var t = d[identifiers_on_map];
        if (has_data_on_reactions && reaction_data_styles.indexOf('text') != -1)
          t += ' ' + d.data_string
        return t
      })
      .on('mousedown', label_mousedown_fn)
      .on('mouseover', function (d) {
        label_mouseover_fn('reaction_label', d)
      })
      .on('mouseout', label_mouseout_fn)
  }

  var add_gene_height = function (y, i) {
    return y + (gene_font_size * 1.5 * (i + 1))
  }

  // gene label
  var all_genes_g = update_selection.select('.all-genes-label-group')
      .selectAll('.gene-label-group')
      .data(function (d) {
        var show_gene_string = ('gene_string' in d &&
                                d.gene_string !== null &&
                                show_gene_reaction_rules &&
                                (!hide_all_labels) &&
                                reaction_data_styles.indexOf('text') !== -1)
        var show_gene_reaction_rule = ('gene_reaction_rule' in d &&
                                       d.gene_reaction_rule !== null &&
                                       show_gene_reaction_rules &&
                                       (!hide_all_labels) )
        if (show_gene_string) {
          // TODO do we ever use gene_string?
          console.warn('Showing gene_string. See TODO in source.')
          return d.gene_string
        } else if (show_gene_reaction_rule) {
          // make the gene string with no data
          var sd = data_styles.gene_string_for_data(d.gene_reaction_rule, null,
                                                    d.genes, null,
                                                    identifiers_on_map, null)
          // add coords for tooltip
          sd.forEach(function (td, i) {
            td.label_x = d.label_x
            td.label_y = add_gene_height(d.label_y, i)
          })
          return sd
        } else {
          return []
        }
      })
  // enter
  var gene_g = all_genes_g.enter()
    .append('g')
    .attr('class', 'gene-label-group')
  gene_g.append('text')
    .attr('class', 'gene-label')
    .style('font-size', gene_font_size + 'px')
    .on('mousedown', label_mousedown_fn)
    .on('mouseover', function (d) {
      label_mouseover_fn('gene_label', d)
    })
    .on('mouseout', label_mouseout_fn)
  // update
  all_genes_g.attr('transform', function (d, i) {
    return 'translate(0, ' + add_gene_height(0, i) + ')'
  })
  // update text
  all_genes_g.select('text').text(function (d) {
    return d['text']
  })
  // exit
  all_genes_g.exit()
    .remove()

  this.callback_manager.run('update_reaction_label', this, update_selection)
}

function create_segment(enter_selection) {
    // create segments
    var g = enter_selection
            .append('g')
            .attr('class', 'segment-group')
            .attr('id', function(d) { return 's'+d.segment_id; });

    // create reaction arrow
    g.append('path')
        .attr('class', 'segment');

    g.append('g')
        .attr('class', 'arrowheads');

    g.append('g')
        .attr('class', 'stoichiometry-labels');

    this.callback_manager.run('create_segment', this, enter_selection);
}

function update_segment(update_selection, scale, cobra_model,
                        drawn_nodes, defs, has_data_on_reactions) {
    var reaction_data_styles = this.settings.get_option('reaction_styles'),
        should_size = (has_data_on_reactions && reaction_data_styles.indexOf('size') != -1),
        should_color = (has_data_on_reactions && reaction_data_styles.indexOf('color') != -1),
        no_data_size = this.settings.get_option('reaction_no_data_size'),
        no_data_color = this.settings.get_option('reaction_no_data_color');

    // update segment attributes
    var highlight_missing  = this.settings.get_option('highlight_missing'),
        hide_secondary_metabolites = this.settings.get_option('hide_secondary_metabolites'),
        primary_r = this.settings.get_option('primary_metabolite_radius'),
        secondary_r = this.settings.get_option('secondary_metabolite_radius'),
        get_arrow_size = function(data, should_size) {
            var width = 20,
                height = 13;
            if (should_size) {
                height = (data === null ? no_data_size : scale.reaction_size(data));
                // check for nan
                if (isNaN(height))
                    height = no_data_size;
                width = height * 2;
            }
            return { width: width, height: height };
        },
        get_disp = function(arrow_size, reversibility, coefficient, node_is_primary) {
            var arrow_height = ((reversibility || coefficient > 0) ?
                                arrow_size.height :
                                0),
                r = node_is_primary ? primary_r : secondary_r;
            return r + arrow_height + 10;
        };
    // update arrows
    update_selection
        .selectAll('.segment')
        .datum(function() {
            return this.parentNode.__data__;
        })
        .style('visibility', function(d) {
            var start = drawn_nodes[d.from_node_id],
                end = drawn_nodes[d.to_node_id];
            if (hide_secondary_metabolites &&
                ((end['node_type']=='metabolite' && !end.node_is_primary) ||
                 (start['node_type']=='metabolite' && !start.node_is_primary)))
                return 'hidden';
            return null;
        })
        .attr('d', function(d) {
            if (d.from_node_id === null || d.to_node_id === null)
                return null;
            var start = drawn_nodes[d.from_node_id],
                end = drawn_nodes[d.to_node_id],
                b1 = d.b1,
                b2 = d.b2;
            // if metabolite, then displace the arrow
            if (start['node_type'] == 'metabolite') {
                var arrow_size = get_arrow_size(d.data, should_size),
                    disp = get_disp(arrow_size, d.reversibility,
                                    d.from_node_coefficient,
                                    start.node_is_primary);
                var direction = (b1 === null) ? end : b1;
                start = displaced_coords(disp, start, direction, 'start');
            }
            if (end['node_type'] == 'metabolite') {
                var arrow_size = get_arrow_size(d.data, should_size),
                    disp = get_disp(arrow_size, d.reversibility,
                                    d.to_node_coefficient,
                                    end.node_is_primary);
                var direction = (b2 === null) ? start : b2;
                end = displaced_coords(disp, direction, end, 'end');
            }
            var curve = ('M' + start.x + ',' + start.y + ' ');
            if (b1 !== null && b2 !== null) {
                curve += ('C' + b1.x + ',' + b1.y + ' ' +
                          b2.x + ',' + b2.y + ' ');
            }
            curve += (end.x + ',' + end.y);
            return curve;
        })
        .style('stroke', function(d) {
            var reaction_id = this.parentNode.parentNode.__data__.bigg_id,
                show_missing = (highlight_missing &&
                                cobra_model !== null &&
                                !(reaction_id in cobra_model.reactions));
            if (show_missing) {
                return 'red';
            }
            if (should_color) {
                var f = d.data;
                return f === null ? no_data_color : scale.reaction_color(f);
            }
            return null;
        })
        .style('stroke-width', function(d) {
            if (should_size) {
                var f = d.data;
                return f === null ? no_data_size : scale.reaction_size(f);
            } else {
                return null;
            }
        });

    // new arrowheads
    var arrowheads = update_selection.select('.arrowheads')
            .selectAll('.arrowhead')
            .data(function (d) {
                var arrowheads = [],
                    start = drawn_nodes[d.from_node_id],
                    b1 = d.b1,
                    end = drawn_nodes[d.to_node_id],
                    b2 = d.b2;
                // hide_secondary_metabolites option
                if (hide_secondary_metabolites &&
                    ((end['node_type']=='metabolite' && !end.node_is_primary) ||
                     (start['node_type']=='metabolite' && !start.node_is_primary)))
                    return arrowheads;

                if (start.node_type == 'metabolite' && (d.reversibility || d.from_node_coefficient > 0)) {
                    var arrow_size = get_arrow_size(d.data, should_size),
                        disp = get_disp(arrow_size, d.reversibility,
                                        d.from_node_coefficient,
                                        start.node_is_primary),
                        direction = (b1 === null) ? end : b1,
                        rotation = utils.to_degrees(utils.get_angle([start, direction])) + 90,
                        loc = displaced_coords(disp, start, direction, 'start');
                    arrowheads.push({ data: d.data,
                                      x: loc.x,
                                      y: loc.y,
                                      size: arrow_size,
                                      rotation: rotation,
                                      show_arrowhead_flux: (((d.from_node_coefficient < 0)==(d.reverse_flux))
                                                            || d.data==0)
                                    });
                }
                if (end.node_type == 'metabolite' && (d.reversibility || d.to_node_coefficient > 0)) {
                    var arrow_size = get_arrow_size(d.data, should_size),
                        disp = get_disp(arrow_size, d.reversibility,
                                        d.to_node_coefficient,
                                        end.node_is_primary),
                        direction = (b2 === null) ? start : b2,
                        rotation = utils.to_degrees(utils.get_angle([end, direction])) + 90,
                        loc = displaced_coords(disp, direction, end, 'end');
                    arrowheads.push({ data: d.data,
                                      x: loc.x,
                                      y: loc.y,
                                      size: arrow_size,
                                      rotation: rotation,
                                      show_arrowhead_flux: (((d.to_node_coefficient < 0)==(d.reverse_flux))
                                                            || d.data==0)
                                    });
                }
                return arrowheads;
            });
    arrowheads.enter().append('path')
        .classed('arrowhead', true);
    // update arrowheads
    arrowheads.attr('d', function(d) {
        return ('M' + [-d.size.width / 2, 0] +
                ' L' + [0, d.size.height] +
                ' L' + [d.size.width / 2, 0] + ' Z');
    }).attr('transform', function(d) {
        return 'translate(' + d.x + ',' + d.y + ')rotate(' + d.rotation + ')';
    }).style('fill', function(d) {
        if (should_color) {
            if (d.show_arrowhead_flux) {
                // show the flux
                var f = d.data;
                return f===null ? no_data_color : scale.reaction_color(f);
            } else {
                // if the arrowhead is not filled because it is reversed
                return '#FFFFFF';
            }
        }
        // default fill color
        return null;
    }).style('stroke', function(d) {
        if (should_color) {
            // show the flux color in the stroke whether or not the fill is present
            var f = d.data;
            return f===null ? no_data_color : scale.reaction_color(f);
        }
        // default stroke color
        return null;
    });
    // remove
    arrowheads.exit().remove();

    // new stoichiometry labels
    var stoichiometry_labels = update_selection.select('.stoichiometry-labels')
            .selectAll('.stoichiometry-label')
            .data(function (d) {
                var labels = [],
                    start = drawn_nodes[d.from_node_id],
                    b1 = d.b1,
                    end = drawn_nodes[d.to_node_id],
                    b2 = d.b2,
                    disp_factor = 1.5;
                // hide_secondary_metabolites option
                if (hide_secondary_metabolites &&
                    ((end['node_type']=='metabolite' && !end.node_is_primary) ||
                     (start['node_type']=='metabolite' && !start.node_is_primary)))
                    return labels;

                if (start.node_type=='metabolite' && (Math.abs(d.from_node_coefficient) != 1)) {
                    var arrow_size = get_arrow_size(d.data, should_size),
                        disp = disp_factor * get_disp(arrow_size, false, 0, end.node_is_primary),
                        direction = (b1 === null) ? end : b1;
                    direction = utils.c_plus_c(direction, utils.rotate_coords(direction, 0.5, start));
                    var loc = displaced_coords(disp, start, direction, 'start');
                    loc = utils.c_plus_c(loc, {x:0, y:7});
                    labels.push({ coefficient: Math.abs(d.from_node_coefficient),
                                  x: loc.x,
                                  y: loc.y,
                                  data: d.data });
                }
                if (end.node_type=='metabolite' && (Math.abs(d.to_node_coefficient) != 1)) {
                    var arrow_size = get_arrow_size(d.data, should_size),
                        disp = disp_factor * get_disp(arrow_size, false, 0, end.node_is_primary),
                        direction = (b2 === null) ? start : b2;
                    direction = utils.c_plus_c(direction, utils.rotate_coords(direction, 0.5, end));
                    var loc = displaced_coords(disp, direction, end, 'end');
                    loc = utils.c_plus_c(loc, {x:0, y:7});
                    labels.push({ coefficient: Math.abs(d.to_node_coefficient),
                                  x: loc.x,
                                  y: loc.y,
                                  data: d.data });
                }
                return labels;
            });

    // add labels
    stoichiometry_labels.enter()
        .append('text')
        .attr('class', 'stoichiometry-label')
        .attr('text-anchor', 'middle');
    // update stoichiometry_labels
    stoichiometry_labels
        .attr('transform', function(d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        })
        .text(function(d) {
            return d.coefficient;
        })
        .style('fill', function (d) {
            if (should_color) {
                // show the flux color
                var f = d.data;
                return f === null ? no_data_color : scale.reaction_color(f);
            }
            // default segment color
            return null;
        });
    // remove
    stoichiometry_labels.exit().remove();

    this.callback_manager.run('update_segment', this, update_selection);
}

function create_bezier(enter_selection) {
    var g = enter_selection.append('g')
            .attr('id', function(d) { return d.bezier_id; })
            .attr('class', function(d) { return 'bezier'; });
    g.append('path')
        .attr('class', 'connect-line');
    g.append('circle')
        .attr('class', function(d) { return 'bezier-circle '+d.bezier; })
        .style('stroke-width', String(1)+'px')
        .attr('r', String(7)+'px');

    this.callback_manager.run('create_bezier', this, enter_selection);
}

function update_bezier(update_selection, show_beziers, drag_behavior,
                       mouseover, mouseout, drawn_nodes, drawn_reactions) {
    var hide_secondary_metabolites = this.settings.get_option('hide_secondary_metabolites');

    if (!show_beziers) {
        update_selection.attr('visibility', 'hidden');
        return;
    } else {
        update_selection.attr('visibility', 'visible');
    }

    // hide secondary
    update_selection
        .style('visibility', function(d) {
            var seg_data = drawn_reactions[d.reaction_id].segments[d.segment_id],
                start = drawn_nodes[seg_data.from_node_id],
                end = drawn_nodes[seg_data.to_node_id];
            if (hide_secondary_metabolites &&
                ((end['node_type']=='metabolite' && !end.node_is_primary) ||
                 (start['node_type']=='metabolite' && !start.node_is_primary)))
                return 'hidden';
            return null;
        });

    // draw bezier points
    update_selection.select('.bezier-circle')
        .call(this.behavior.turn_off_drag)
        .call(drag_behavior)
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        .attr('transform', function(d) {
            if (d.x==null || d.y==null) return '';
            return 'translate('+d.x+','+d.y+')';
        });

    // update bezier line
    update_selection
        .select('.connect-line')
        .attr('d', function(d) {
            var node,
                segment_d = drawn_reactions[d.reaction_id].segments[d.segment_id];
            node = (d.bezier=='b1' ?
                    drawn_nodes[segment_d.from_node_id] :
                    drawn_nodes[segment_d.to_node_id]);
            if (d.x==null || d.y==null || node.x==null || node.y==null)
                return '';
            return 'M'+d.x+', '+d.y+' '+(node.x)+','+(node.y);
        });

    this.callback_manager.run('update_bezier', this, update_selection);
}

function create_node(enter_selection, drawn_nodes, drawn_reactions) {
    /** Run on enter selection for nodes.

     Arguments
     ---------

     enter_selection: The D3.js enter selection.

     drawn_nodes: The nodes object (e.g. Map.nodes).

     drawn_reactions: The reactions object (e.g. Map.reactions).

     */

    // create nodes
    var g = enter_selection
            .append('g')
            .attr('class', 'node')
            .attr('id', function(d) { return 'n'+d.node_id; });

    // create metabolite circle and label
    g.append('circle')
        .attr('class', function(d) {
            var c = 'node-circle';
            if (d.node_type!==null)
                c += (' ' + d.node_type + '-circle');
            return c;
        });
    // labels
    var metabolite_groups = g.filter(function(d) {
        return d.node_type=='metabolite';
    });
    metabolite_groups.append('text')
        .attr('class', 'node-label label');

    this.callback_manager.run('create_node', this, enter_selection);
}

/**
 * Run on the update selection for nodes.
 * @param {D3 Selection} update_selection - The D3.js update selection.
 * @param {Scale} scale - A Scale object.
 * @param {Boolean} has_data_on_nodes - Boolean to determine whether data needs to be drawn.
 * @param {Function} mousedown_fn - A function to call on mousedown for a node.
 * @param {Function} click_fn - A function to call on click for a node.
 * @param {Function} mouseover_fn - A function to call on mouseover for a node.
 * @param {Function} mouseout_fn - A function to call on mouseout for a node.
 * @param {D3 Behavior} drag_behavior - The D3.js drag behavior object for the nodes.
 * @param {D3 Behavior} label_drag_behavior - The D3.js drag behavior object for the node labels.
 */
function update_node (update_selection, scale, has_data_on_nodes,
                      mousedown_fn, click_fn, mouseover_fn, mouseout_fn,
                      drag_behavior, label_drag_behavior) {
  // update circle and label location
  var hide_secondary_metabolites = this.settings.get_option('hide_secondary_metabolites')
  var primary_r = this.settings.get_option('primary_metabolite_radius')
  var secondary_r = this.settings.get_option('secondary_metabolite_radius')
  var marker_r = this.settings.get_option('marker_radius')
  var hide_all_labels = this.settings.get_option('hide_all_labels')
  var identifiers_on_map = this.settings.get_option('identifiers_on_map')
  var metabolite_data_styles = this.settings.get_option('metabolite_styles')
  var no_data_style = { color: this.settings.get_option('metabolite_no_data_color'),
                        size: this.settings.get_option('metabolite_no_data_size') }
  var label_mousedown_fn = this.behavior.label_mousedown
  var label_mouseover_fn = this.behavior.label_mouseover
  var label_mouseout_fn = this.behavior.label_mouseout

  var mg = update_selection
    .select('.node-circle')
    .attr('transform', function(d) {
      return 'translate(' + d.x + ',' + d.y + ')'
    })
    .style('visibility', function(d) {
      return hideNode(d, hide_secondary_metabolites) ? 'hidden' : null
    })
    .attr('r', function(d) {
      if (d.node_type === 'metabolite') {
        var should_scale = (has_data_on_nodes &&
                            metabolite_data_styles.indexOf('size') !== -1)
        if (should_scale) {
          var f = d.data
          return f === null ? no_data_style['size'] : scale.metabolite_size(f)
        } else {
          return d.node_is_primary ? primary_r : secondary_r
        }
      }
      // midmarkers and multimarkers
      return marker_r
    })
    .style('fill', function(d) {
      if (d.node_type=='metabolite') {
        var should_color_data = (has_data_on_nodes &&
                                 metabolite_data_styles.indexOf('color') !== -1)
        if (should_color_data) {
          var f = d.data
          return f === null ? no_data_style['color'] : scale.metabolite_color(f)
        } else {
          return null
        }
      }
      // midmarkers and multimarkers
      return null
    })
    .call(this.behavior.turn_off_drag)
    .call(drag_behavior)
    .on('mousedown', mousedown_fn)
    .on('click', click_fn)
    .on('mouseover', mouseover_fn)
    .on('mouseout', mouseout_fn)

  // update node label visibility
  var node_label = update_selection
      .select('.node-label')
    .attr('visibility', hide_all_labels ? 'hidden' : 'visible')
  if (!hide_all_labels) {
    node_label
      .style('visibility', function(d) {
        return hideNode(d, hide_secondary_metabolites) ? 'hidden' : null
      })
      .attr('transform', function(d) {
        return 'translate(' + d.label_x + ',' + d.label_y + ')'
      })
      .text(function(d) {
        var t = d[identifiers_on_map]
        if (has_data_on_nodes && metabolite_data_styles.indexOf('text') !== -1)
          t += ' ' + d.data_string
        return t
      })
      .call(this.behavior.turn_off_drag)
      .call(label_drag_behavior)
      .on('mousedown', label_mousedown_fn)
      .on('mouseover', function (d) {
        label_mouseover_fn('node_label', d)
      })
      .on('mouseout', label_mouseout_fn)
  }

  this.callback_manager.run('update_node', this, update_selection)

  function hideNode (d, hide_secondary_metabolites) {
    return (d.node_type === 'metabolite' &&
            hide_secondary_metabolites &&
            !d.node_is_primary)
  }
}

function create_text_label(enter_selection) {
    enter_selection.append('g')
        .attr('id', function(d) { return 'l'+d.text_label_id; })
        .attr('class', 'text-label')
        .append('text')
        .attr('class', 'label');

    this.callback_manager.run('create_text_label', this, enter_selection);
}

function update_text_label (update_selection) {
  var mousedown_fn = this.behavior.text_label_mousedown
  var click_fn = this.behavior.text_label_click
  var drag_behavior = this.behavior.selectable_drag
  var turn_off_drag = this.behavior.turn_off_drag

  update_selection
    .select('.label')
    .text(function (d) { return d.text })
    .attr('transform', function (d) {
      return 'translate(' + d.x + ',' + d.y + ')'
    })
    .on('mousedown', mousedown_fn)
    .on('click', click_fn)
    .call(turn_off_drag)
    .call(drag_behavior)

  this.callback_manager.run('update_text_label', this, update_selection)
}

function displaced_coords(reaction_arrow_displacement, start, end, displace) {
    utils.check_undefined(arguments, ['reaction_arrow_displacement', 'start', 'end', 'displace']);

    var length = reaction_arrow_displacement,
        hyp = utils.distance(start, end),
        new_x, new_y;
    if (!length || !hyp) console.error('Bad value');
    if (displace=='start') {
        new_x = start.x + length * (end.x - start.x) / hyp,
        new_y = start.y + length * (end.y - start.y) / hyp;
    } else if (displace=='end') {
        new_x = end.x - length * (end.x - start.x) / hyp,
        new_y = end.y - length * (end.y - start.y) / hyp;
    } else { console.error('bad displace value: ' + displace); }
    return {x: new_x, y: new_y};
}

},{"./CallbackManager":5,"./data_styles":28,"./utils":33}],11:[function(require,module,exports){
/** KeyManager

 Manage key listeners and events.

 Arguments
 ---------

 assigned_keys (default: {}): An object defining keys to bind.

 input_list (default: []): A list of inputs that will override keyboard
 shortcuts when in focus.

 selection (default: global): A node to bind the events to.

 ctrl_equals_cmd (default: false): If true, then control and command have the
 same effect.

 */


var utils = require('./utils');
var Mousetrap = require('mousetrap');
var _ = require('underscore');


var KeyManager = utils.make_class();
// instance methods
KeyManager.prototype = {
    init: init,
    update: update,
    toggle: toggle,
    add_escape_listener: add_escape_listener,
    add_enter_listener: add_enter_listener,
    add_key_listener: add_key_listener
};
module.exports = KeyManager;


// instance methods
function init(assigned_keys, input_list, selection, ctrl_equals_cmd) {
    // default Arguments
    this.assigned_keys = assigned_keys || {};
    this.input_list = input_list || [];
    this.mousetrap = selection ? new Mousetrap(selection) : new Mousetrap;
    this.ctrl_equals_cmd = (!_.isBoolean(ctrl_equals_cmd)) ? false : ctrl_equals_cmd;

    // Fix mousetrap behavior; by default, it ignore shortcuts when inputs are
    // in focus.
    // TODO NOT WORKING https://craig.is/killing/mice
    // consider swithching to https://github.com/PolicyStat/combokeys
    this.mousetrap.stopCallback = function() { return false; };

    this.enabled = true;
    this.update();
}


function _add_cmd(key, ctrl_equals_cmd) {
    /** If ctrl_equals_cmd is true and key has ctrl+ in it, return an array with
     ctrl+ and meta+ variations.

     */
    if (!ctrl_equals_cmd) return key;
    var key_ar = _.isArray(key) ? key : [key];
    var new_ar = key_ar.reduce(function(c, k) {
        var n = k.replace('ctrl+', 'meta+');
        if (n !== k) c.push(n);
        return c;
    }, key_ar.slice());
    return new_ar.length === key_ar.length ? key : new_ar;
}

/**
 * Updated key bindings if attributes have changed.
 */
function update() {
    this.mousetrap.reset();
    if (!this.enabled) return;

    // loop through keys
    for (var key_id in this.assigned_keys) {
        var assigned_key = this.assigned_keys[key_id];

        // OK if this is missing
        if (!assigned_key.key) continue;

        var key_to_bind = _add_cmd(assigned_key.key, this.ctrl_equals_cmd);
        // remember the input_list
        assigned_key.input_list = this.input_list;
        this.mousetrap.bind(key_to_bind, function(e) {
            // check inputs
            var input_blocking = false;
            if (this.ignore_with_input) {
                for (var i = 0, l = this.input_list.length; i < l; i++) {
                    if (this.input_list[i].is_visible()) {
                        input_blocking = true;
                        break;
                    }
                }
            }

            if (!input_blocking) {
                if (this.fn) this.fn.call(this.target);
                else console.warn('No function for key: ' + this.key);
                e.preventDefault();
            }
        }.bind(assigned_key), 'keydown');
    }
}


function toggle(on_off) {
    /** Turn the key manager on or off.

     */
    if (_.isUndefined(on_off)) on_off = !this.enabled;
    this.enabled = on_off;
    this.update();
}


function add_enter_listener(callback, one_time) {
    /** Call the callback when the enter key is pressed, then
     unregisters the listener.

     */
    return this.add_key_listener('enter', callback, one_time);
}


function add_escape_listener(callback, one_time) {
    /** Call the callback when the escape key is pressed, then
     unregisters the listener.

     */
    return this.add_key_listener('escape', callback, one_time);
}


function add_key_listener(key_name, callback, one_time) {
    /** Call the callback when the key is pressed, then unregisters the
     listener. Returns a function that will unbind the event.

     callback: The callback function with no arguments.

     key_name: A key name, or list of key names, as defined by the mousetrap
     library: https://craig.is/killing/mice

     one_time: If True, then cancel the listener after the first execution.

     */

    if (_.isUndefined(one_time)) one_time = false;

    // unbind function ready to go
    var unbind = this.mousetrap.unbind.bind(this.mousetrap, key_name);

    this.mousetrap.bind(_add_cmd(key_name, this.ctrl_equals_cmd), function(e) {
        e.preventDefault();
        callback();
        if (one_time) unbind();
    });

    return unbind;
}

},{"./utils":33,"mousetrap":36,"underscore":38}],12:[function(require,module,exports){
/** Map

 Defines the metabolic map data, and manages drawing and building.

 Arguments
 ---------

 svg: The parent SVG container for the map.

 css:

 selection: A d3 selection for a node to place the map inside.

 selection:

 zoom_container:

 settings:

 cobra_model:

 canvas_size_and_loc:

 enable_search:

 map_name: (Optional, Default: 'new map')

 map_id: (Optional, Default: A string of random characters.)

 map_description: (Optional, Default: '')

 Callbacks
 ---------

 map.callback_manager.run('set_status', null, status);
 map.callback_manager.run('toggle_beziers', null, beziers_enabled);
 map.callback_manager.run('select_metabolite_with_id', null, selected_node, coords);
 map.callback_manager.run('select_selectable', null, node_count, selected_node, coords);
 map.callback_manager.run('deselect_nodes');
 map.callback_manager.run('select_text_label');
 map.callback_manager.run('before_svg_export');
 map.callback_manager.run('after_svg_export');
 map.callback_manager.run('before_png_export');
 map.callback_manager.run('after_png_export');
 map.callback_manager.run('before_convert_map');
 map.callback_manager.run('after_convert_map');
 this.callback_manager.run('calc_data_stats__reaction', null, changed);
 this.callback_manager.run('calc_data_stats__metabolite', null, changed);

 */

/* global d3 */

var utils = require('./utils');
var Draw = require('./Draw');
var Behavior = require('./Behavior');
var Scale = require('./Scale');
var build = require('./build');
var UndoStack = require('./UndoStack');
var CallbackManager = require('./CallbackManager');
var KeyManager = require('./KeyManager');
var Canvas = require('./Canvas');
var data_styles = require('./data_styles');
var SearchIndex = require('./SearchIndex');

var bacon = require('baconjs');
var _ = require('underscore');


var Map = utils.make_class();
// class methods
Map.from_data = from_data;
// instance methods
Map.prototype = {
    // setup
    init: init,
    // more setup
    setup_containers: setup_containers,
    reset_containers: reset_containers,
    // appearance
    set_status: set_status,
    clear_map: clear_map,
    // selection
    select_all: select_all,
    select_none: select_none,
    invert_selection: invert_selection,
    select_selectable: select_selectable,
    select_metabolite_with_id: select_metabolite_with_id,
    select_single_node: select_single_node,
    deselect_nodes: deselect_nodes,
    select_text_label: select_text_label,
    deselect_text_labels: deselect_text_labels,
    // build
    new_reaction_from_scratch: new_reaction_from_scratch,
    extend_nodes: extend_nodes,
    extend_reactions: extend_reactions,
    new_reaction_for_metabolite: new_reaction_for_metabolite,
    cycle_primary_node: cycle_primary_node,
    toggle_selected_node_primary: toggle_selected_node_primary,
    new_text_label: new_text_label,
    edit_text_label: edit_text_label,
    // delete
    delete_selected: delete_selected,
    delete_selectable: delete_selectable,
    delete_node_data: delete_node_data,
    delete_segment_data: delete_segment_data,
    delete_reaction_data: delete_reaction_data,
    delete_text_label_data: delete_text_label_data,
    // find
    get_selected_node_ids: get_selected_node_ids,
    get_selected_nodes: get_selected_nodes,
    get_selected_text_label_ids: get_selected_text_label_ids,
    get_selected_text_labels: get_selected_text_labels,
    segments_and_reactions_for_nodes: segments_and_reactions_for_nodes,
    // draw
    draw_everything: draw_everything,
    // draw reactions
    draw_all_reactions: draw_all_reactions,
    draw_these_reactions: draw_these_reactions,
    clear_deleted_reactions: clear_deleted_reactions,
    // draw nodes
    draw_all_nodes: draw_all_nodes,
    draw_these_nodes: draw_these_nodes,
    clear_deleted_nodes: clear_deleted_nodes,
    // draw text_labels
    draw_all_text_labels: draw_all_text_labels,
    draw_these_text_labels: draw_these_text_labels,
    clear_deleted_text_labels: clear_deleted_text_labels,
    // draw beziers
    draw_all_beziers: draw_all_beziers,
    draw_these_beziers: draw_these_beziers,
    clear_deleted_beziers: clear_deleted_beziers,
    toggle_beziers: toggle_beziers,
    hide_beziers: hide_beziers,
    show_beziers: show_beziers,
    // data
    has_cobra_model: has_cobra_model,
    apply_reaction_data_to_map: apply_reaction_data_to_map,
    apply_metabolite_data_to_map: apply_metabolite_data_to_map,
    apply_gene_data_to_map: apply_gene_data_to_map,
    // data statistics
    get_data_statistics: get_data_statistics,
    calc_data_stats: calc_data_stats,
    // zoom
    zoom_extent_nodes: zoom_extent_nodes,
    zoom_extent_canvas: zoom_extent_canvas,
    _zoom_extent: _zoom_extent,
    get_size: get_size,
    zoom_to_reaction: zoom_to_reaction,
    zoom_to_node: zoom_to_node,
    zoom_to_text_label: zoom_to_text_label,
    highlight_reaction: highlight_reaction,
    highlight_node: highlight_node,
    highlight_text_label: highlight_text_label,
    highlight: highlight,
    // full screen
    listen_for_full_screen: listen_for_full_screen,
    unlisten_for_full_screen: unlisten_for_full_screen,
    full_screen: full_screen,
    // io
    save: save,
    map_for_export: map_for_export,
    save_svg: save_svg,
    save_png: save_png,
    convert_map: convert_map
};
module.exports = Map;


// -------------------------------------------------------------------------
// setup

function init(svg, css, selection, zoom_container, settings,
              cobra_model, canvas_size_and_loc, enable_search,
              map_name, map_id, map_description) {
    if (canvas_size_and_loc === null) {
        var size = zoom_container.get_size()
        canvas_size_and_loc = {x: -size.width, y: -size.height,
                               width: size.width*3, height: size.height*3}
    }

    if (_.isUndefined(map_name) || map_name === null || map_name == '')
        map_name = 'new_map'
    else
        map_name = String(map_name)
    if (_.isUndefined(map_id) || map_id === null || map_id == '')
        map_id = utils.generate_map_id()
    else
        map_id = String(map_id)
    if (_.isUndefined(map_description) || map_description === null)
        map_description = ''
    else
        map_description = String(map_description)

    // set up the callbacks
    this.callback_manager = new CallbackManager()

    // set up the defs
    this.svg = svg
    this.defs = utils.setup_defs(svg, css)

    // make the canvas
    this.canvas = new Canvas(selection, canvas_size_and_loc)

    this.setup_containers(selection)
    this.sel = selection
    this.zoom_container = zoom_container

    this.settings = settings

    // set the model AFTER loading the datasets
    this.cobra_model = cobra_model

    this.largest_ids = { reactions: -1,
                         nodes: -1,
                         segments: -1,
                         text_labels: -1 }

    // make the scales
    this.scale = new Scale()
    // initialize stats
    this.calc_data_stats('reaction')
    this.calc_data_stats('metabolite')
    this.scale.connect_to_settings(this.settings, this,
                                   get_data_statistics.bind(this))

    // make the undo/redo stack
    this.undo_stack = new UndoStack()

    // make a behavior object
    this.behavior = new Behavior(this, this.undo_stack)

    // draw manager
    this.draw = new Draw(this.behavior, this.settings)

    // make a key manager
    this.key_manager = new KeyManager()
    this.key_manager.ctrl_equals_cmd = true

    // make the search index
    this.enable_search = enable_search
    this.search_index = new SearchIndex()

    // map properties
    this.map_name = map_name
    this.map_id = map_id
    this.map_description = map_description

    // deal with the window
    var window_translate = {'x': 0, 'y': 0},
        window_scale = 1

    // hide beziers
    this.beziers_enabled = false

    // data
    this.has_data_on_reactions = false
    this.has_data_on_nodes = false

    this.nodes = {}
    this.reactions = {}
    this.beziers = {}
    this.text_labels = {}

    // update data with null to populate data-specific attributes
    this.apply_reaction_data_to_map(null)
    this.apply_metabolite_data_to_map(null)
    this.apply_gene_data_to_map(null)

    // rotation mode off
    this.rotation_on = false

    // set up full screen listener
    this.listen_for_full_screen(function () {
        setTimeout(function() {
            this.zoom_extent_canvas()
        }.bind(this), 50)
    }.bind(this))
}

// -------------------------------------------------------------------------
// Import

function from_data(map_data, svg, css, selection, zoom_container, settings,
                   cobra_model, enable_search) {
    /** Load a json map and add necessary fields for rendering.

     */

    var canvas = map_data[1].canvas,
        map_name = map_data[0].map_name,
        map_id = map_data[0].map_id,
        map_description = (map_data[0].map_description.replace(/(\nLast Modified.*)+$/g, '')
                           + '\nLast Modified ' + Date(Date.now()).toString()),
        map = new Map(svg, css, selection, zoom_container, settings,
                      cobra_model, canvas, enable_search,
                      map_name, map_id, map_description);

    map.reactions = map_data[1].reactions;
    map.nodes = map_data[1].nodes;
    map.text_labels = map_data[1].text_labels;

    for (var n_id in map.nodes) {
        var node = map.nodes[n_id];

        // clear all the connected segments
        node.connected_segments = [];

        //  populate the nodes search index.
        if (enable_search) {
            if (node.node_type!='metabolite') continue;
            map.search_index.insert('n'+n_id, { 'name': node.bigg_id,
                                                'data': { type: 'metabolite',
                                                          node_id: n_id }});
            map.search_index.insert('n_name'+n_id, { 'name': node.name,
                                                     'data': { type: 'metabolite',
                                                               node_id: n_id }});
        }
    }

    // Propagate coefficients and reversibility, build the connected
    // segments, add bezier points, and populate the reaction search index.
    for (var r_id in map.reactions) {
        var reaction = map.reactions[r_id];

        // reaction search index
        if (enable_search) {
            map.search_index.insert('r' + r_id,
                                    { 'name': reaction.bigg_id,
                                      'data': { type: 'reaction',
                                                reaction_id: r_id }});
            map.search_index.insert('r_name' + r_id,
                                    { 'name': reaction.name,
                                      'data': { type: 'reaction',
                                                reaction_id: r_id }});
            for (var g_id in reaction.genes) {
                var gene = reaction.genes[g_id];
                map.search_index.insert('r' + r_id + '_g' + g_id,
                                        { 'name': gene.bigg_id,
                                          'data': { type: 'reaction',
                                                    reaction_id: r_id }});
                map.search_index.insert('r' + r_id + '_g_name' + g_id,
                                        { 'name': gene.name,
                                          'data': { type: 'reaction',
                                                    reaction_id: r_id }});
            }
        }

        // keep track of any bad segments
        var segments_to_delete = [];
        for (var s_id in reaction.segments) {
            var segment = reaction.segments[s_id];

            // propagate reversibility
            segment.reversibility = reaction.reversibility;

            // if there is an error with to_ or from_ nodes, remove this segment
            if (!(segment.from_node_id in map.nodes) || !(segment.to_node_id in map.nodes)) {
                console.warn('Bad node references in segment ' + s_id + '. Deleting segment.');
                segments_to_delete.push(s_id);
                continue
            }

            var from_node = map.nodes[segment.from_node_id],
                to_node = map.nodes[segment.to_node_id];

            // propagate coefficients
            reaction.metabolites.forEach(function(met) {
                if (met.bigg_id==from_node.bigg_id) {
                    segment.from_node_coefficient = met.coefficient;
                } else if (met.bigg_id==to_node.bigg_id) {
                    segment.to_node_coefficient = met.coefficient;
                }
            });

            // build connected segments
            [from_node, to_node].forEach(function(node) {
                node.connected_segments.push({ segment_id: s_id,
                                               reaction_id: r_id });
            });

            // If the metabolite has no bezier points, then add them.
            var start = map.nodes[segment.from_node_id],
                end = map.nodes[segment.to_node_id];
            if (start['node_type']=='metabolite' || end['node_type']=='metabolite') {
                var midpoint = utils.c_plus_c(start, utils.c_times_scalar(utils.c_minus_c(end, start), 0.5));
                if (segment.b1 === null) segment.b1 = midpoint;
                if (segment.b2 === null) segment.b2 = midpoint;
            }

        }
        // delete the bad segments
        segments_to_delete.forEach(function(s_id) {
            delete reaction.segments[s_id];
        });
    }

    // add text_labels to the search index
    if (enable_search) {
        for (var label_id in map.text_labels) {
            var label = map.text_labels[label_id];
            map.search_index.insert('l'+label_id, { 'name': label.text,
                                                    'data': { type: 'text_label',
                                                              text_label_id: label_id }});
        }
    }

    // populate the beziers
    map.beziers = build.new_beziers_for_reactions(map.reactions);

    // get largest ids for adding new reactions, nodes, text labels, and
    // segments
    map.largest_ids.reactions = get_largest_id(map.reactions);
    map.largest_ids.nodes = get_largest_id(map.nodes);
    map.largest_ids.text_labels = get_largest_id(map.text_labels);

    var largest_segment_id = 0;
    for (var id in map.reactions) {
        largest_segment_id = get_largest_id(map.reactions[id].segments,
                                            largest_segment_id);
    }
    map.largest_ids.segments = largest_segment_id;

    // update data with null to populate data-specific attributes
    map.apply_reaction_data_to_map(null);
    map.apply_metabolite_data_to_map(null);
    map.apply_gene_data_to_map(null);

    return map;

    // definitions
    function get_largest_id(obj, current_largest) {
        /** Return the largest integer key in obj, or current_largest, whichever is bigger. */
        if (_.isUndefined(current_largest)) current_largest = 0;
        if (_.isUndefined(obj)) return current_largest;
        return Math.max.apply(null, Object.keys(obj).map(function(x) {
            return parseInt(x);
        }).concat([current_largest]));
    }
}

// ---------------------------------------------------------------------
// more setup

function setup_containers(sel) {
    sel.append('g')
        .attr('id', 'reactions');
    sel.append('g')
        .attr('id', 'nodes');
    sel.append('g')
        .attr('id', 'beziers');
    sel.append('g')
        .attr('id', 'text-labels');
}
function reset_containers() {
    this.sel.select('#reactions')
        .selectAll('.reaction')
        .remove();
    this.sel.select('#nodes')
        .selectAll('.node')
        .remove();
    this.sel.select('#beziers')
        .selectAll('.bezier')
        .remove();
    this.sel.select('#text-labels')
        .selectAll('.text-label')
        .remove();
}

// -------------------------------------------------------------------------
// Appearance

function set_status(status, time) {
    /** Set the status of the map, with an optional expiration
     time. Rendering the status is taken care of by the Builder.

     Arguments
     ---------

     status: The status string.

     time: An optional time, in ms, after which the status is set to ''.

     */

    this.callback_manager.run('set_status', null, status);
    // clear any other timers on the status bar
    clearTimeout(this._status_timer);
    this._status_timer = null;

    if (time!==undefined) {
        this._status_timer = setTimeout(function() {
            this.callback_manager.run('set_status', null, '');
        }.bind(this), time);
    }
}
function clear_map() {
    this.reactions = {};
    this.beziers = {};
    this.nodes = {};
    this.text_labels = {};
    this.map_name = 'new_map';
    this.map_id = utils.generate_map_id();
    this.map_description = '';
    // reaction_data onto existing map reactions
    this.apply_reaction_data_to_map(null);
    this.apply_metabolite_data_to_map(null);
    this.apply_gene_data_to_map(null);
    this.draw_everything();
}
function has_cobra_model() {
    return (this.cobra_model !== null);
}
function draw_everything() {
    /** Draw the all reactions, nodes, & text labels.

     */
    this.draw_all_reactions(true, true); // also draw beziers
    this.draw_all_nodes(true);
    this.draw_all_text_labels();
}

function draw_all_reactions(draw_beziers, clear_deleted) {
    /** Draw all reactions, and clear deleted reactions.

     Arguments
     ---------

     draw_beziers: (Boolean, default True) Whether to also draw the bezier
     control points.

     clear_deleted: (Optional, Default: true) Boolean, if true, then also
     clear deleted nodes.

     */
    if (_.isUndefined(draw_beziers)) draw_beziers = true;
    if (_.isUndefined(clear_deleted)) clear_deleted = true;

    // Draw all reactions.
    var reaction_ids = [];
    for (var reaction_id in this.reactions) {
        reaction_ids.push(reaction_id);
    }
    // If draw_beziers is true, just draw them all, rather than deciding
    // which ones to draw.
    this.draw_these_reactions(reaction_ids, false);
    if (draw_beziers && this.beziers_enabled)
        this.draw_all_beziers();

    // Clear all deleted reactions.
    if (clear_deleted)
        this.clear_deleted_reactions(draw_beziers);
}

function draw_these_reactions(reaction_ids, draw_beziers) {
    /** Draw specific reactions.

     Does nothing with exit selection. Use clear_deleted_reactions to remove
     reactions from the DOM.

     Arguments
     ---------

     reactions_ids: An array of reaction_ids to update.

     draw_beziers: (Boolean, default True) Whether to also draw the bezier
     control points.

     */
    if (_.isUndefined(draw_beziers)) draw_beziers = true;

    // find reactions for reaction_ids
    var reaction_subset = utils.object_slice_for_ids_ref(this.reactions,
                                                         reaction_ids);

    // function to update reactions
    var update_fn = function(sel) {
        return this.draw.update_reaction(sel, this.scale, this.cobra_model,
                                         this.nodes, this.defs,
                                         this.has_data_on_reactions);
    }.bind(this);

    // draw the reactions
    utils.draw_an_object(this.sel, '#reactions', '.reaction', reaction_subset,
                         'reaction_id', this.draw.create_reaction.bind(this.draw),
                         update_fn);

    if (draw_beziers) {
        // particular beziers to draw
        var bezier_ids = build.bezier_ids_for_reaction_ids(reaction_subset);
        this.draw_these_beziers(bezier_ids);
    }
}

function clear_deleted_reactions(draw_beziers) {
    /** Remove any reactions that are not in *this.reactions*.

     Arguments
     ---------

     draw_beziers: (Boolean, default True) Whether to also clear deleted
     bezier control points.

     */
    if (_.isUndefined(draw_beziers)) draw_beziers = true;

    // remove deleted reactions and segments
    utils.draw_an_object(this.sel, '#reactions', '.reaction', this.reactions, 'reaction_id',
                         null,
                         clear_deleted_segments,
                         function(sel) { sel.remove(); });

    if (draw_beziers==true)
        this.clear_deleted_beziers();

    // definitions
    function clear_deleted_segments(update_selection) {
        // draw segments
        utils.draw_a_nested_object(update_selection, '.segment-group', 'segments', 'segment_id',
                                   null,
                                   null,
                                   function(sel) { sel.remove(); });
    };
}

function draw_all_nodes(clear_deleted) {
    /** Draw all nodes, and clear deleted nodes.

     Arguments
     ---------

     clear_deleted: (Optional, Default: true) Boolean, if true, then also
     clear deleted nodes.

     */
    if (clear_deleted === undefined) clear_deleted = true;

    var node_ids = [];
    for (var node_id in this.nodes) {
        node_ids.push(node_id);
    }
    this.draw_these_nodes(node_ids);

    // clear the deleted nodes
    if (clear_deleted)
        this.clear_deleted_nodes();
}

function draw_these_nodes(node_ids) {
    /** Draw specific nodes.

     Does nothing with exit selection. Use clear_deleted_nodes to remove
     nodes from the DOM.

     Arguments
     ---------

     nodes_ids: An array of node_ids to update.

     */
    // find reactions for reaction_ids
    var node_subset = utils.object_slice_for_ids_ref(this.nodes, node_ids);

    // functions to create and update nodes
    var create_fn = function(sel) {
        return this.draw.create_node(sel,
                                     this.nodes,
                                     this.reactions);
    }.bind(this),
        update_fn = function(sel) {
            return this.draw.update_node(sel,
                                         this.scale,
                                         this.has_data_on_nodes,
                                         this.behavior.selectable_mousedown,
                                         this.behavior.selectable_click,
                                         this.behavior.node_mouseover,
                                         this.behavior.node_mouseout,
                                         this.behavior.selectable_drag,
                                         this.behavior.node_label_drag);
        }.bind(this);

    // draw the nodes
    utils.draw_an_object(this.sel, '#nodes', '.node', node_subset, 'node_id',
                         create_fn, update_fn);
}

function clear_deleted_nodes() {
    /** Remove any nodes that are not in *this.nodes*.

     */
    // run remove for exit selection
    utils.draw_an_object(this.sel, '#nodes', '.node', this.nodes, 'node_id',
                         null, null, function(sel) { sel.remove(); });
}

function draw_all_text_labels() {
    // Draw all text_labels.
    var text_label_ids = [];
    for (var text_label_id in this.text_labels) {
        text_label_ids.push(text_label_id);
    }
    this.draw_these_text_labels(text_label_ids);

    // Clear all deleted text_labels.
    this.clear_deleted_text_labels();
}

function draw_these_text_labels(text_label_ids) {
    /** Draw specific text_labels.

     Does nothing with exit selection. Use clear_deleted_text_labels to remove
     text_labels from the DOM.

     Arguments
     ---------

     text_labels_ids: An array of text_label_ids to update.

     */
    // find reactions for reaction_ids
    var text_label_subset = utils.object_slice_for_ids_ref(this.text_labels, text_label_ids);

    // function to update text_labels
    var update_fn = function(sel) {
        return this.draw.update_text_label(sel, this.behavior);;
    }.bind(this);

    // draw the text_labels
    utils.draw_an_object(this.sel, '#text-labels', '.text-label',
                         text_label_subset, 'text_label_id',
                         this.draw.create_text_label.bind(this.draw),
                         update_fn);
}

function clear_deleted_text_labels() {
    /** Remove any text_labels that are not in *this.text_labels*.

     */
    // clear deleted
    utils.draw_an_object(this.sel, '#text-labels', '.text-label',
                         this.text_labels, 'text_label_id', null, null,
                         function(sel) { sel.remove(); });
}

function draw_all_beziers() {
    /** Draw all beziers, and clear deleted reactions.

     */
    var bezier_ids = [];
    for (var bezier_id in this.beziers) {
        bezier_ids.push(bezier_id);
    }
    this.draw_these_beziers(bezier_ids);

    // clear delete beziers
    this.clear_deleted_beziers();
}

function draw_these_beziers(bezier_ids) {
    /** Draw specific beziers.

     Does nothing with exit selection. Use clear_deleted_beziers to remove
     beziers from the DOM.

     Arguments
     ---------

     beziers_ids: An array of bezier_ids to update.

     */
    // find reactions for reaction_ids
    var bezier_subset = utils.object_slice_for_ids_ref(this.beziers, bezier_ids);

    // function to update beziers
    var update_fn = function(sel) {
        return this.draw.update_bezier(sel,
                                       this.beziers_enabled,
                                       this.behavior.bezier_drag,
                                       this.behavior.bezier_mouseover,
                                       this.behavior.bezier_mouseout,
                                       this.nodes,
                                       this.reactions);
    }.bind(this);

    // draw the beziers
    utils.draw_an_object(this.sel, '#beziers', '.bezier', bezier_subset,
                         'bezier_id', this.draw.create_bezier.bind(this.draw),
                         update_fn);
}

function clear_deleted_beziers() {
    /** Remove any beziers that are not in *this.beziers*.

     */
    // remove deleted
    utils.draw_an_object(this.sel, '#beziers', '.bezier', this.beziers,
                         'bezier_id', null, null,
                         function(sel) { sel.remove(); });
}

function show_beziers() {
    this.toggle_beziers(true);
}

function hide_beziers() {
    this.toggle_beziers(false);
}

function toggle_beziers(on_off) {
    if (_.isUndefined(on_off)) this.beziers_enabled = !this.beziers_enabled;
    else this.beziers_enabled = on_off;
    this.draw_all_beziers();
    this.callback_manager.run('toggle_beziers', null, this.beziers_enabled);
}

function apply_reaction_data_to_map(data) {
    /**  Returns True if the scale has changed.

     */
    var styles = this.settings.get_option('reaction_styles'),
        compare_style = this.settings.get_option('reaction_compare_style');
    var has_data = data_styles.apply_reaction_data_to_reactions(this.reactions, data,
                                                                styles, compare_style);
    this.has_data_on_reactions = has_data;

    return this.calc_data_stats('reaction');
}

function apply_metabolite_data_to_map(data) {
    /**  Returns True if the scale has changed.

     */
    var styles = this.settings.get_option('metabolite_styles'),
        compare_style = this.settings.get_option('metabolite_compare_style');

    var has_data = data_styles.apply_metabolite_data_to_nodes(this.nodes, data,
                                                              styles, compare_style);
    this.has_data_on_nodes = has_data;

    return this.calc_data_stats('metabolite');
}

function apply_gene_data_to_map(gene_data_obj) {
    /** Returns True if the scale has changed.

     Arguments
     ---------

     gene_data_obj: The gene data object, with the following style:

     { reaction_id: { rule: 'rule_string', genes: { gene_id: value } } }

     */
    var styles = this.settings.get_option('reaction_styles'),
        compare_style = this.settings.get_option('reaction_compare_style'),
        identifiers_on_map = this.settings.get_option('identifiers_on_map'),
        and_method_in_gene_reaction_rule = this.settings.get_option('and_method_in_gene_reaction_rule');

    var has_data = data_styles.apply_gene_data_to_reactions(this.reactions, gene_data_obj,
                                                            styles, identifiers_on_map,
                                                            compare_style,
                                                            and_method_in_gene_reaction_rule);
    this.has_data_on_reactions = has_data;

    return this.calc_data_stats('reaction');
}

// ------------------------------------------------
// Data domains
function get_data_statistics() {
    return this.data_statistics;
}

function calc_data_stats(type) {
    /** Returns True if the stats have changed.

     Arguments
     ---------

     type: Either 'metabolite' or 'reaction'

     */

    if (['reaction', 'metabolite'].indexOf(type) == -1)
        throw new Error('Bad type ' + type);

    // make the data structure
    if (!('data_statistics' in this)) {
        this.data_statistics = {};
        this.data_statistics[type] = {};
    } else if (!(type in this.data_statistics)) {
        this.data_statistics[type] = {};
    }

    var same = true;
    // default min and max
    var vals = [];
    if (type == 'metabolite') {
        for (var node_id in this.nodes) {
            var node = this.nodes[node_id];
            // check number
            if (node.data !== null)
                vals.push(node.data);
        }
    } else if (type == 'reaction') {
        for (var reaction_id in this.reactions) {
            var reaction = this.reactions[reaction_id];
            // check number
            if (reaction.data !== null)
                vals.push(reaction.data);
        }
    }

    // calculate these statistics
    var quartiles = utils.quartiles(vals),
        funcs = [['min', on_array(Math.min)],
                 ['max', on_array(Math.max)],
                 ['mean', utils.mean],
                 ['Q1', function() { return quartiles[0]; }],
                 ['median', function() { return quartiles[1]; }],
                 ['Q3', function() { return quartiles[2]; }]];
    funcs.forEach(function(ar) {
        var new_val, name = ar[0];
        if (vals.length == 0) {
            new_val = null;
        } else {
            var fn = ar[1];
            new_val = fn(vals);
        }
        if (new_val != this.data_statistics[type][name])
            same = false;
        this.data_statistics[type][name] = new_val;
    }.bind(this));

    if (type == 'reaction')
        this.callback_manager.run('calc_data_stats__reaction', null, !same);
    else
        this.callback_manager.run('calc_data_stats__metabolite', null, !same);
    return !same;

    // definitions
    function on_array(fn) {
        return function (array) { return fn.apply(null, array); };
    }
}

// ---------------------------------------------------------------------
// Node interaction

function get_coords_for_node(node_id) {
    var node = this.nodes[node_id],
        coords = {'x': node.x, 'y': node.y};
    return coords;
}
function get_selected_node_ids() {
    var selected_node_ids = [];
    this.sel.select('#nodes')
        .selectAll('.selected')
        .each(function(d) { selected_node_ids.push(d.node_id); });
    return selected_node_ids;
}
function get_selected_nodes() {
    var selected_nodes = {},
        self = this;
    this.sel.select('#nodes')
        .selectAll('.selected')
        .each(function(d) {
            selected_nodes[d.node_id] = this.nodes[d.node_id];
        }.bind(this));
    return selected_nodes;
}
function get_selected_text_label_ids() {
    var selected_text_label_ids = [];
    this.sel.select('#text-labels')
        .selectAll('.selected')
        .each(function(d) { selected_text_label_ids.push(d.text_label_id); });
    return selected_text_label_ids;
}
function get_selected_text_labels() {
    var selected_text_labels = {},
        self = this;
    this.sel.select('#text-labels')
        .selectAll('.selected')
        .each(function(d) {
            selected_text_labels[d.text_label_id] = this.text_labels[d.text_label_id];
        }.bind(this));
    return selected_text_labels;
}

function select_all() {
    /** Select all nodes and text labels.

     */
    this.sel.selectAll('#nodes,#text-labels')
        .selectAll('.node,.text-label')
        .classed('selected', true);
}

function select_none() {
    /** Deselect all nodes and text labels.

     */
    this.sel.selectAll('.selected')
        .classed('selected', false);
}

function invert_selection() {
    /** Invert selection of nodes and text labels.

     */
    var selection = this.sel.selectAll('#nodes,#text-labels')
            .selectAll('.node,.text-label');
    selection.classed('selected', function() {
        return !d3.select(this).classed('selected');
    });
}

function select_metabolite_with_id(node_id) {
    /** Select a metabolite with the given id, and turn off the reaction
     target.

     */
    // deselect all text labels
    this.deselect_text_labels();

    var node_selection = this.sel.select('#nodes').selectAll('.node'),
        coords,
        selected_node;
    node_selection.classed('selected', function(d) {
        var selected = String(d.node_id) == String(node_id);
        if (selected) {
            selected_node = d;
            coords = { x: d.x, y: d.y };
        }
        return selected;
    });
    this.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
    this.callback_manager.run('select_metabolite_with_id', null, selected_node, coords);
}

function select_selectable(node, d, shift_key_on) {
    /** Select a metabolite or text label, and manage the shift key. */
    shift_key_on = _.isUndefined(shift_key_on) ? false : shift_key_on;
    var classable_selection = this.sel.selectAll('#nodes,#text-labels')
            .selectAll('.node,.text-label'),
        classable_node;
    if (d3.select(node).attr('class').indexOf('text-label') == -1) {
        // node
        classable_node = node.parentNode;
    } else {
        // text-label
        classable_node = node;
    }
    // toggle selection
    if (shift_key_on) {
        // toggle this node
        d3.select(classable_node)
            .classed('selected', !d3.select(classable_node).classed('selected'));
    } else {
        // unselect all other nodes, and select this one
        classable_selection.classed('selected', false);
        d3.select(classable_node).classed('selected', true);
    }
    // run the select_metabolite callback
    var selected_nodes = this.sel.select('#nodes').selectAll('.selected'),
        node_count = 0,
        coords,
        selected_node;
    selected_nodes.each(function(d) {
        selected_node = d;
        coords = { x: d.x, y: d.y };
        node_count++;
    });
    this.callback_manager.run('select_selectable', null, node_count, selected_node, coords);
}

function select_single_node() {
    /** Unselect all but one selected node, and return the node.

     If no nodes are selected, return null.

     */
    var out = null,
        self = this,
        node_selection = this.sel.select('#nodes').selectAll('.selected');
    node_selection.classed('selected', function(d, i) {
        if (i==0) {
            out = d;
            return true;
        } else {
            return false;
        }
    });
    return out;
}
function deselect_nodes() {
    var node_selection = this.sel.select('#nodes').selectAll('.node');
    node_selection.classed('selected', false);
    this.callback_manager.run('deselect_nodes');
}
function select_text_label(sel, d) {
    // deselect all nodes
    this.deselect_nodes();
    // find the new selection
    // Ignore shift key and only allow single selection for now
    var text_label_selection = this.sel.select('#text-labels').selectAll('.text-label');
    text_label_selection.classed('selected', function(p) { return d === p; });
    var selected_text_labels = this.sel.select('#text-labels').selectAll('.selected'),
        coords;
    selected_text_labels.each(function(d) {
        coords = { x: d.x, y: d.y };
    });
    this.callback_manager.run('select_text_label');
}

function deselect_text_labels() {
    var text_label_selection = this.sel.select('#text-labels').selectAll('.text-label');
    text_label_selection.classed('selected', false);
}

// ---------------------------------------------------------------------
// Delete

function delete_selected() {
    /** Delete the selected nodes and associated segments and reactions, and selected labels.

     Undoable.

     */
    var selected_nodes = this.get_selected_nodes(),
        selected_text_labels = this.get_selected_text_labels();
    if (Object.keys(selected_nodes).length >= 1 ||
        Object.keys(selected_text_labels).length >= 1)
        this.delete_selectable(selected_nodes, selected_text_labels, true);
}

function delete_selectable(selected_nodes, selected_text_labels, should_draw) {
    /** Delete the nodes and associated segments and reactions. Undoable.

     Arguments
     ---------

     selected_nodes: An object that is a subset of map.nodes.

     selected_text_labels: An object that is a subset of map.text_labels.

     should_draw: A boolean argument to determine whether to draw the changes to the map.

     */

    var out = this.segments_and_reactions_for_nodes(selected_nodes),
        segment_objs_w_segments = out.segment_objs_w_segments, // TODO repeated values here
        reactions = out.reactions;

    // copy nodes to undelete
    var saved_nodes = utils.clone(selected_nodes),
        saved_segment_objs_w_segments = utils.clone(segment_objs_w_segments),
        saved_reactions = utils.clone(reactions),
        saved_text_labels = utils.clone(selected_text_labels),
        delete_and_draw = function(nodes, reactions, segment_objs,
                                   selected_text_labels) {
            // delete nodes, segments, and reactions with no segments
            this.delete_node_data(Object.keys(selected_nodes));
            this.delete_segment_data(segment_objs); // also deletes beziers
            this.delete_reaction_data(Object.keys(reactions));
            this.delete_text_label_data(Object.keys(selected_text_labels));

            // apply the reaction and node data
            var changed_r_scale = false,
                changed_m_scale = false;
            if (this.has_data_on_reactions)
                changed_r_scale = this.calc_data_stats('reaction');
            if (this.has_data_on_nodes)
                changed_m_scale = this.calc_data_stats('metabolite');

            // redraw
            if (should_draw) {
                if (changed_r_scale)
                    this.draw_all_reactions(true, true);
                else
                    this.clear_deleted_reactions(); // also clears segments and beziers
                if (changed_m_scale)
                    this.draw_all_nodes(true);
                else
                    this.clear_deleted_nodes();
                this.clear_deleted_text_labels();
            }
        }.bind(this);

    // delete
    delete_and_draw(selected_nodes, reactions, segment_objs_w_segments,
                    selected_text_labels);

    // add to undo/redo stack
    this.undo_stack.push(function() {
        // undo
        // redraw the saved nodes, reactions, and segments

        this.extend_nodes(saved_nodes);
        this.extend_reactions(saved_reactions);
        var reaction_ids_to_draw = Object.keys(saved_reactions);
        for (var segment_id in saved_segment_objs_w_segments) {
            var segment_obj = saved_segment_objs_w_segments[segment_id];

            var segment = segment_obj.segment;
            this.reactions[segment_obj.reaction_id]
                .segments[segment_obj.segment_id] = segment;

            // updated connected nodes
            [segment.from_node_id, segment.to_node_id].forEach(function(node_id) {
                // not necessary for the deleted nodes
                if (node_id in saved_nodes) return;
                var node = this.nodes[node_id];
                node.connected_segments.push({ reaction_id: segment_obj.reaction_id,
                                               segment_id: segment_obj.segment_id });
            }.bind(this));

            // extend the beziers
            var seg_id = segment_obj.segment_id,
                r_id = segment_obj.reaction_id,
                seg_o = {};
            seg_o[seg_id] = segment_obj.segment;
            utils.extend(this.beziers, build.new_beziers_for_segments(seg_o, r_id));

            if (reaction_ids_to_draw.indexOf(segment_obj.reaction_id)==-1)
                reaction_ids_to_draw.push(segment_obj.reaction_id);
        }

        // apply the reaction and node data
        // if the scale changes, redraw everything
        if (this.has_data_on_reactions) {
            var scale_changed = this.calc_data_stats('reaction');
            if (scale_changed) this.draw_all_reactions(true, false);
            else this.draw_these_reactions(reaction_ids_to_draw);
        } else {
            if (should_draw) this.draw_these_reactions(reaction_ids_to_draw);
        }
        if (this.has_data_on_nodes) {
            var scale_changed = this.calc_data_stats('metabolite');
            if (should_draw) {
                if (scale_changed) this.draw_all_nodes(false);
                else this.draw_these_nodes(Object.keys(saved_nodes));
            }
        } else {
            if (should_draw) this.draw_these_nodes(Object.keys(saved_nodes));
        }

        // redraw the saved text_labels
        utils.extend(this.text_labels, saved_text_labels);
        if (should_draw) this.draw_these_text_labels(Object.keys(saved_text_labels));
        // copy text_labels to re-delete
        selected_text_labels = utils.clone(saved_text_labels);

        // copy nodes to re-delete
        selected_nodes = utils.clone(saved_nodes);
        segment_objs_w_segments = utils.clone(saved_segment_objs_w_segments);
        reactions = utils.clone(saved_reactions);
    }.bind(this), function () {
        // redo
        // clone the nodes and reactions, to redo this action later
        delete_and_draw(selected_nodes, reactions, segment_objs_w_segments,
                        selected_text_labels);
    }.bind(this));
}

function delete_node_data(node_ids) {
    /** Delete nodes, and remove from search index.
     */
    node_ids.forEach(function(node_id) {
        if (this.enable_search && this.nodes[node_id].node_type=='metabolite') {
            var found = (this.search_index.remove('n' + node_id)
                         && this.search_index.remove('n_name' + node_id));
            if (!found)
                console.warn('Could not find deleted metabolite in search index');
        }
        delete this.nodes[node_id];
    }.bind(this));
}

function delete_segment_data(segment_objs) {
    /** Delete segments, update connected_segments in nodes, and delete
     bezier points.

     segment_objs: Object with values like { reaction_id: '123', segment_id: '456' }

     */
    for (var segment_id in segment_objs) {
        var segment_obj = segment_objs[segment_id];
        var reaction = this.reactions[segment_obj.reaction_id];

        // segment already deleted
        if (!(segment_obj.segment_id in reaction.segments)) return;

        var segment = reaction.segments[segment_obj.segment_id];
        // updated connected nodes
        [segment.from_node_id, segment.to_node_id].forEach(function(node_id) {
            if (!(node_id in this.nodes)) return;
            var node = this.nodes[node_id];
            node.connected_segments = node.connected_segments.filter(function(so) {
                return so.segment_id != segment_obj.segment_id;
            });
        }.bind(this));

        // remove beziers
        ['b1', 'b2'].forEach(function(bez) {
            var bez_id = build.bezier_id_for_segment_id(segment_obj.segment_id, bez);
            delete this.beziers[bez_id];
        }.bind(this));

        delete reaction.segments[segment_obj.segment_id];
    }
}
function delete_reaction_data(reaction_ids) {
    /** Delete reactions, segments, and beziers, and remove reaction from
     search index.

     */
    reaction_ids.forEach(function(reaction_id) {
        // remove beziers
        var reaction = this.reactions[reaction_id];
        for (var segment_id in reaction.segments) {
            ['b1', 'b2'].forEach(function(bez) {
                var bez_id = build.bezier_id_for_segment_id(segment_id, bez);
                delete this.beziers[bez_id];
            }.bind(this));
        }
        // delete reaction
        delete this.reactions[reaction_id];
        // remove from search index
        var found = (this.search_index.remove('r' + reaction_id)
                     && this.search_index.remove('r_name' + reaction_id));
        if (!found)
            console.warn('Could not find deleted reaction ' +
                         reaction_id + ' in search index');
        for (var g_id in reaction.genes) {
            var found = (this.search_index.remove('r' + reaction_id + '_g' + g_id)
                         && this.search_index.remove('r' + reaction_id + '_g_name' + g_id));
            if (!found)
                console.warn('Could not find deleted gene ' +
                             g_id + ' in search index');
        }
    }.bind(this));
}
function delete_text_label_data(text_label_ids) {
    /** delete text labels for an array of ids
     */
    text_label_ids.forEach(function(text_label_id) {
        // delete label
        delete this.text_labels[text_label_id];
        // remove from search index
        var found = this.search_index.remove('l'+text_label_id);
        if (!found)
            console.warn('Could not find deleted text label in search index');
    }.bind(this));
}

// ---------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------

/**
 * Draw a reaction on a blank canvas.
 * @param {String} starting_reaction - bigg_id for a reaction to draw.
 * @param {Coords} coords - coordinates to start drawing
 */
function new_reaction_from_scratch(starting_reaction, coords, direction) {
    // If there is no cobra model, error
    if (!this.cobra_model) {
        console.error('No CobraModel. Cannot build new reaction')
        return
    }

    // Set reaction coordinates and angle. Be sure to clone the reaction.
    var cobra_reaction = utils.clone(this.cobra_model.reactions[starting_reaction])

    // check for empty reactions
    if (_.size(cobra_reaction.metabolites) === 0)
        throw Error('No metabolites in reaction ' + cobra_reaction.bigg_id)

    // create the first node
    var reactant_ids = _.map(cobra_reaction.metabolites,
                             function (coeff, met_id) { return [ coeff, met_id ] })
            .filter(function (x) { return x[0] < 0 }) // coeff < 0
            .map(function(x) { return x[1] }) // metabolite id
    // get the first reactant or else the first product
    var metabolite_id = (reactant_ids.length > 0 ?
                         reactant_ids[0] :
                         Object.keys(cobra_reaction.metabolites)[0])
    var metabolite = this.cobra_model.metabolites[metabolite_id]
    var selected_node_id = String(++this.largest_ids.nodes)
    var label_d = { x: 30, y: 10 }
    var selected_node = { connected_segments: [],
                          x: coords.x,
                          y: coords.y,
                          node_is_primary: true,
                          label_x: coords.x + label_d.x,
                          label_y: coords.y + label_d.y,
                          name: metabolite.name,
                          bigg_id: metabolite_id,
                          node_type: 'metabolite' }
    var new_nodes = {}
    new_nodes[selected_node_id] = selected_node

    // draw
    extend_and_draw_metabolite.apply(this, [ new_nodes, selected_node_id ])

    // clone the nodes and reactions, to redo this action later
    var saved_nodes = utils.clone(new_nodes)

    // draw the reaction
    var out = this.new_reaction_for_metabolite(starting_reaction,
                                               selected_node_id,
                                               direction, false),
        reaction_redo = out.redo,
        reaction_undo = out.undo

    // add to undo/redo stack
    this.undo_stack.push(function() {
        // undo
        // first undo the reaction
        reaction_undo()
        // get the nodes to delete
        this.delete_node_data(Object.keys(new_nodes))
        // save the nodes and reactions again, for redo
        new_nodes = utils.clone(saved_nodes)
        // draw
        this.clear_deleted_nodes()
        // deselect
        this.deselect_nodes()
    }.bind(this), function () {
        // redo
        // clone the nodes and reactions, to redo this action later
        extend_and_draw_metabolite.apply(this, [new_nodes, selected_node_id])
        // now redo the reaction
        reaction_redo()
    }.bind(this))

    return

    // definitions
    function extend_and_draw_metabolite(new_nodes, selected_node_id) {
        this.extend_nodes(new_nodes)
        if (this.has_data_on_nodes) {
            var scale_changed = this.apply_metabolite_data_to_nodes(new_nodes)
            if (scale_changed) this.draw_all_nodes(false)
            else this.draw_these_nodes([selected_node_id])
        } else {
            this.draw_these_nodes([selected_node_id])
        }
    }
}

function extend_nodes(new_nodes) {
    /** Add new nodes to data and search index.

     */
    if (this.enable_search) {
        for (var node_id in new_nodes) {
            var node = new_nodes[node_id];
            if (node.node_type != 'metabolite')
                continue;
            this.search_index.insert('n' + node_id,
                                     { 'name': node.bigg_id,
                                       'data': { type: 'metabolite',
                                                 node_id: node_id }});
            this.search_index.insert('n_name' + node_id,
                                     { 'name': node.name,
                                       'data': { type: 'metabolite',
                                                 node_id: node_id }});
        }
    }
    utils.extend(this.nodes, new_nodes);
}
function extend_reactions(new_reactions) {
    /** Add new reactions to data and search index.

     */
    if (this.enable_search) {
        for (var r_id in new_reactions) {
            var reaction = new_reactions[r_id];
            this.search_index.insert('r' + r_id, { 'name': reaction.bigg_id,
                                                   'data': { type: 'reaction',
                                                             reaction_id: r_id }});
            this.search_index.insert('r_name' + r_id, { 'name': reaction.name,
                                                        'data': { type: 'reaction',
                                                                  reaction_id: r_id }});
            for (var g_id in reaction.genes) {
                var gene = reaction.genes[g_id];
                this.search_index.insert('r' + r_id + '_g' + g_id,
                                         { 'name': gene.bigg_id,
                                           'data': { type: 'reaction',
                                                     reaction_id: r_id }});
                this.search_index.insert('r' + r_id + '_g_name' + g_id,
                                         { 'name': gene.name,
                                           'data': { type: 'reaction',
                                                     reaction_id: r_id }});
            }
        }
    }
    utils.extend(this.reactions, new_reactions);
}

/**
 * Build a new reaction starting with selected_met. Undoable.
 * @param {String} reaction_bigg_id - The BiGG ID of the reaction to draw.
 * @param {String} selected_node_id - The ID of the node to begin drawing with.
 * @param {Number} direction - The direction to draw in.
 * @param {Boolean} [apply_undo_redo=true] - If true, then add to the undo
 * stack. Otherwise, just return the undo and redo functions.
 * @return An object of undo and redo functions:
 *   { undo: undo_function, redo: redo_function }
 */
function new_reaction_for_metabolite(reaction_bigg_id, selected_node_id,
                                     direction, apply_undo_redo) {
    // default args
    if (apply_undo_redo === undefined) apply_undo_redo = true;

    // get the metabolite node
    var selected_node = this.nodes[selected_node_id];

    // set reaction coordinates and angle
    // be sure to copy the reaction recursively
    var cobra_reaction = this.cobra_model.reactions[reaction_bigg_id];

    // build the new reaction
    var out = build.new_reaction(reaction_bigg_id, cobra_reaction,
                                 this.cobra_model.metabolites,
                                 selected_node_id,
                                 utils.clone(selected_node),
                                 this.largest_ids,
                                 this.settings.get_option('cofactors'),
                                 direction),
        new_nodes = out.new_nodes,
        new_reactions = out.new_reactions,
        new_beziers = out.new_beziers;

    // draw
    extend_and_draw_reaction.apply(this, [new_nodes, new_reactions,
                                          new_beziers, selected_node_id]);

    // clone the nodes and reactions, to redo this action later
    var saved_nodes = utils.clone(new_nodes),
        saved_reactions = utils.clone(new_reactions),
        saved_beziers = utils.clone(new_beziers);

    // add to undo/redo stack
    var undo_fn = function() {
        // undo
        // get the nodes to delete
        delete new_nodes[selected_node_id];
        this.delete_node_data(Object.keys(new_nodes));
        this.delete_reaction_data(Object.keys(new_reactions)); // also deletes beziers
        select_metabolite_with_id.apply(this, [selected_node_id]);
        // save the nodes and reactions again, for redo
        new_nodes = utils.clone(saved_nodes);
        new_reactions = utils.clone(saved_reactions);
        new_beziers = utils.clone(saved_beziers);
        // draw
        if (this.has_data_on_reactions) {
            var scale_changed = this.calc_data_stats('reaction');
            if (scale_changed) this.draw_all_reactions(true, true);
            else this.draw_these_reactions(Object.keys(new_reactions));
        } else {
            this.clear_deleted_reactions(true); // also clears segments and beziers
        }
        if (this.has_data_on_nodes) {
            var scale_changed = this.calc_data_stats('metabolite');
            if (scale_changed) this.draw_all_nodes(true);
            else this.draw_these_nodes(Object.keys(new_nodes));
        } else {
            this.clear_deleted_nodes();
        }
    }.bind(this),
        redo_fn = function () {
            // redo
            // clone the nodes and reactions, to redo this action later
            extend_and_draw_reaction.apply(this, [new_nodes, new_reactions,
                                                  new_beziers, selected_node_id]);
        }.bind(this);

    if (apply_undo_redo)
        this.undo_stack.push(undo_fn, redo_fn);

    return { undo: undo_fn,
             redo: redo_fn };

    // definitions
    function extend_and_draw_reaction(new_nodes, new_reactions, new_beziers,
                                      selected_node_id) {
        this.extend_reactions(new_reactions);
        utils.extend(this.beziers, new_beziers);
        // remove the selected node so it can be updated
        this.delete_node_data([selected_node_id]); // TODO this is a hack. fix
        this.extend_nodes(new_nodes);

        // apply the reaction and node data to the scales
        // if the scale changes, redraw everything
        if (this.has_data_on_reactions) {
            var scale_changed = this.calc_data_stats('reaction');
            if (scale_changed) this.draw_all_reactions(true, false);
            else this.draw_these_reactions(Object.keys(new_reactions));
        } else {
            this.draw_these_reactions(Object.keys(new_reactions));
        }
        if (this.has_data_on_nodes) {
            var scale_changed = this.calc_data_stats('metabolite');
            if (scale_changed) this.draw_all_nodes(false);
            else this.draw_these_nodes(Object.keys(new_nodes));
        } else {
            this.draw_these_nodes(Object.keys(new_nodes));
        }

        // select new primary metabolite
        for (var node_id in new_nodes) {
            var node = new_nodes[node_id];
            if (node.node_is_primary && node_id!=selected_node_id) {
                this.select_metabolite_with_id(node_id);
                var new_coords = { x: node.x, y: node.y };
                if (this.zoom_container)
                    this.zoom_container.translate_off_screen(new_coords);
            }
        }
    }

}
function cycle_primary_node() {
    var selected_nodes = this.get_selected_nodes();
    // get the first node
    var node_id = Object.keys(selected_nodes)[0],
        node = selected_nodes[node_id],
        reactions = this.reactions,
        nodes = this.nodes;
    // make the other reactants or products secondary
    // 1. Get the connected anchor nodes for the node
    var connected_anchor_ids = [],
        reactions_to_draw;
    nodes[node_id].connected_segments.forEach(function(segment_info) {
        reactions_to_draw = [segment_info.reaction_id];
        var segment;
        try {
            segment = reactions[segment_info.reaction_id].segments[segment_info.segment_id];
            if (segment === undefined) throw new Error('undefined segment');
        } catch (e) {
            console.warn('Could not find connected segment ' + segment_info.segment_id);
            return;
        }
        connected_anchor_ids.push(segment.from_node_id==node_id ?
                                  segment.to_node_id : segment.from_node_id);
    });
    // can only be connected to one anchor
    if (connected_anchor_ids.length != 1) {
        console.error('Only connected nodes with a single reaction can be selected');
        return;
    }
    var connected_anchor_id = connected_anchor_ids[0];
    // 2. find nodes connected to the anchor that are metabolites
    var related_node_ids = [node_id];
    var segments = [];
    nodes[connected_anchor_id].connected_segments.forEach(function(segment_info) { // deterministic order
        var segment;
        try {
            segment = reactions[segment_info.reaction_id].segments[segment_info.segment_id];
            if (segment === undefined) throw new Error('undefined segment');
        } catch (e) {
            console.warn('Could not find connected segment ' + segment_info.segment_id);
            return;
        }
        var conn_met_id = segment.from_node_id == connected_anchor_id ? segment.to_node_id : segment.from_node_id,
            conn_node = nodes[conn_met_id];
        if (conn_node.node_type == 'metabolite' && conn_met_id != node_id) {
            related_node_ids.push(String(conn_met_id));
        }
    });
    // 3. make sure they only have 1 reaction connection, and check if
    // they match the other selected nodes
    for (var i=0; i<related_node_ids.length; i++) {
        if (nodes[related_node_ids[i]].connected_segments.length > 1) {
            console.error('Only connected nodes with a single reaction can be selected');
            return;
        }
    }
    for (var a_selected_node_id in selected_nodes) {
        if (a_selected_node_id!=node_id && related_node_ids.indexOf(a_selected_node_id) == -1) {
            console.warn('Selected nodes are not on the same reaction');
            return;
        }
    }
    // 4. change the primary node, and change coords, label coords, and beziers
    var nodes_to_draw = [],
        last_i = related_node_ids.length - 1,
        last_node = nodes[related_node_ids[last_i]],
        last_is_primary = last_node.node_is_primary,
        last_coords = { x: last_node.x, y: last_node.y,
                        label_x: last_node.label_x, label_y: last_node.label_y };
    if (last_node.connected_segments.length > 1)
        console.warn('Too many connected segments for node ' + last_node.node_id);
    var last_segment_info = last_node.connected_segments[0], // guaranteed above to have only one
        last_segment;
    try {
        last_segment = reactions[last_segment_info.reaction_id].segments[last_segment_info.segment_id];
        if (last_segment === undefined) throw new Error('undefined segment');
    } catch (e) {
        console.error('Could not find connected segment ' + last_segment_info.segment_id);
        return;
    }
    var last_bezier = { b1: last_segment.b1, b2: last_segment.b2 },
        primary_node_id;
    related_node_ids.forEach(function(related_node_id) {
        var node = nodes[related_node_id],
            this_is_primary = node.node_is_primary,
            these_coords = { x: node.x, y: node.y,
                             label_x: node.label_x, label_y: node.label_y },
            this_segment_info = node.connected_segments[0],
            this_segment = reactions[this_segment_info.reaction_id].segments[this_segment_info.segment_id],
            this_bezier = { b1: this_segment.b1, b2: this_segment.b2 };
        node.node_is_primary = last_is_primary;
        node.x = last_coords.x; node.y = last_coords.y;
        node.label_x = last_coords.label_x; node.label_y = last_coords.label_y;
        this_segment.b1 = last_bezier.b1; this_segment.b2 = last_bezier.b2;
        last_is_primary = this_is_primary;
        last_coords = these_coords;
        last_bezier = this_bezier;
        if (node.node_is_primary) primary_node_id = related_node_id;
        nodes_to_draw.push(related_node_id);
    });
    // 5. cycle the connected_segments array so the next time, it cycles differently
    var old_connected_segments = nodes[connected_anchor_id].connected_segments,
        last_i = old_connected_segments.length - 1,
        new_connected_segments = [old_connected_segments[last_i]];
    old_connected_segments.forEach(function(segment, i) {
        if (last_i==i) return;
        new_connected_segments.push(segment);
    });
    nodes[connected_anchor_id].connected_segments = new_connected_segments;
    // 6. draw the nodes
    this.draw_these_nodes(nodes_to_draw);
    this.draw_these_reactions(reactions_to_draw);
    // 7. select the primary node
    this.select_metabolite_with_id(primary_node_id);
    return;
}

function toggle_selected_node_primary() {
    /** Toggle the primary/secondary status of each selected node.

     Undoable.

     */
    var selected_node_ids = this.get_selected_node_ids(),
        go = function(ids) {
            var nodes_to_draw = {},
                hide_secondary_metabolites = this.settings.get_option('hide_secondary_metabolites');
            ids.forEach(function(id) {
                if (!(id in this.nodes)) {
                    console.warn('Could not find node: ' + id);
                    return;
                }
                var node = this.nodes[id];
                if (node.node_type == 'metabolite') {
                    node.node_is_primary = !node.node_is_primary;
                    nodes_to_draw[id] = node;
                }
            }.bind(this));
            // draw the nodes
            this.draw_these_nodes(Object.keys(nodes_to_draw));
            // draw associated reactions
            if (hide_secondary_metabolites) {
                var out = this.segments_and_reactions_for_nodes(nodes_to_draw),
                    reaction_ids_to_draw_o = {};
                for (var id in out.segment_objs_w_segments) {
                    var r_id = out.segment_objs_w_segments[id].reaction_id;
                    reaction_ids_to_draw_o[r_id] = true;
                }
                this.draw_these_reactions(Object.keys(reaction_ids_to_draw_o));
            }
        }.bind(this);

    // go
    go(selected_node_ids);

    // add to the undo stack
    this.undo_stack.push(function () {
        go(selected_node_ids);
    }, function () {
        go(selected_node_ids);
    });
}

function segments_and_reactions_for_nodes(nodes) {
    /** Get segments and reactions that should be deleted with node deletions

     */
    var segment_objs_w_segments = {},
        these_reactions = {},
        segment_ids_for_reactions = {},
        reactions = this.reactions;
    // for each node
    for (var node_id in nodes) {
        var node = nodes[node_id];
        // find associated segments and reactions
        node.connected_segments.forEach(function(segment_obj) {
            var segment;
            try {
                segment = reactions[segment_obj.reaction_id].segments[segment_obj.segment_id];
                if (segment === undefined) throw new Error('undefined segment');
            } catch (e) {
                console.warn('Could not find connected segments for node');
                return;
            }
            var segment_obj_w_segment = utils.clone(segment_obj);
            segment_obj_w_segment['segment'] = utils.clone(segment);
            segment_objs_w_segments[segment_obj.segment_id] = segment_obj_w_segment;
            if (!(segment_obj.reaction_id in segment_ids_for_reactions))
                segment_ids_for_reactions[segment_obj.reaction_id] = [];
            segment_ids_for_reactions[segment_obj.reaction_id].push(segment_obj.segment_id);
        });
    }
    // find the reactions that should be deleted because they have no segments left
    for (var reaction_id in segment_ids_for_reactions) {
        var reaction = reactions[reaction_id],
            these_ids = segment_ids_for_reactions[reaction_id],
            has = true;
        for (var segment_id in reaction.segments) {
            if (these_ids.indexOf(segment_id)==-1) has = false;
        }
        if (has) these_reactions[reaction_id] = reaction;
    }
    return { segment_objs_w_segments: segment_objs_w_segments, reactions: these_reactions };
}

function new_text_label(coords, text) {
    // make an label
    var out = build.new_text_label(this.largest_ids, text, coords);
    this.text_labels[out.id] = out.label;
    var sel = this.draw_these_text_labels([out.id]);
    // add to the search index
    this.search_index.insert('l' + out.id, { 'name': text,
                                             'data': { type: 'text_label',
                                                       text_label_id: out.id }});
    return out.id;
}

function edit_text_label(text_label_id, new_value, should_draw) {
    // save old value
    var saved_value = this.text_labels[text_label_id].text,
        edit_and_draw = function(new_val, should_draw) {
            // set the new value
            this.text_labels[text_label_id].text = new_val;
            if (should_draw) this.draw_these_text_labels([text_label_id]);
            // update in the search index
            var record_id = 'l' + text_label_id,
                found = this.search_index.remove(record_id);
            if (!found)
                console.warn('Could not find modified text label in search index');
            this.search_index.insert(record_id, { 'name': new_val,
                                                  'data': { type: 'text_label',
                                                            text_label_id: text_label_id }});
        }.bind(this);

    // edit the label
    edit_and_draw(new_value, should_draw);

    // add to undo stack
    this.undo_stack.push(function() {
        edit_and_draw(saved_value, should_draw);
    }, function () {
        edit_and_draw(new_value, should_draw);
    });
}

// -------------------------------------------------------------------------
// Zoom

function zoom_extent_nodes(margin) {
    /** Zoom to fit all the nodes.

     margin: optional argument to set the margins as a fraction of height.

     Returns error if one is raised.

     */
    this._zoom_extent(margin, 'nodes');
}

function zoom_extent_canvas(margin) {
    /** Zoom to fit the canvas.

     margin: optional argument to set the margins as a fraction of height.

     Returns error if one is raised.

     */
    this._zoom_extent(margin, 'canvas');
}

function _zoom_extent(margin, mode) {
    /** Zoom to fit the canvas or all the nodes. Returns error if one is
     raised.

     Arguments
     ---------

     margin: optional argument to set the margins.

     mode: Values are 'nodes', 'canvas'.

     */

    // optional args
    if (_.isUndefined(margin)) margin = (mode=='nodes' ? 0.2 : 0);
    if (_.isUndefined(mode)) mode = 'canvas';

    var new_zoom, new_pos,
        size = this.get_size();
    // scale margin to window size
    margin = margin * size.height;

    if (mode=='nodes') {
        // get the extent of the nodes
        var min = { x: null, y: null }, // TODO make infinity?
            max = { x: null, y: null };
        for (var node_id in this.nodes) {
            var node = this.nodes[node_id];
            if (min.x===null) min.x = node.x;
            if (min.y===null) min.y = node.y;
            if (max.x===null) max.x = node.x;
            if (max.y===null) max.y = node.y;

            min.x = Math.min(min.x, node.x);
            min.y = Math.min(min.y, node.y);
            max.x = Math.max(max.x, node.x);
            max.y = Math.max(max.y, node.y);
        }
        // set the zoom
        new_zoom = Math.min((size.width - margin*2) / (max.x - min.x),
                            (size.height - margin*2) / (max.y - min.y));
        new_pos = { x: - (min.x * new_zoom) + margin + ((size.width - margin*2 - (max.x - min.x)*new_zoom) / 2),
                    y: - (min.y * new_zoom) + margin + ((size.height - margin*2 - (max.y - min.y)*new_zoom) / 2) };
    } else if (mode=='canvas') {
        // center the canvas
        new_zoom =  Math.min((size.width - margin*2) / (this.canvas.width),
                             (size.height - margin*2) / (this.canvas.height));
        new_pos = { x: - (this.canvas.x * new_zoom) + margin + ((size.width - margin*2 - this.canvas.width*new_zoom) / 2),
                    y: - (this.canvas.y * new_zoom) + margin + ((size.height - margin*2 - this.canvas.height*new_zoom) / 2) };
    } else {
        return console.error('Did not recognize mode');
    }
    this.zoom_container.go_to(new_zoom, new_pos);
    return null;
}

function get_size() {
    return this.zoom_container.get_size();
}

function zoom_to_reaction(reaction_id) {
    var reaction = this.reactions[reaction_id],
        new_zoom = 0.5,
        size = this.get_size(),
        new_pos = { x: - reaction.label_x * new_zoom + size.width/2,
                    y: - reaction.label_y * new_zoom + size.height/2 };
    this.zoom_container.go_to(new_zoom, new_pos);
}

function zoom_to_node(node_id) {
    var node = this.nodes[node_id],
        new_zoom = 0.5,
        size = this.get_size(),
        new_pos = { x: - node.label_x * new_zoom + size.width/2,
                    y: - node.label_y * new_zoom + size.height/2 };
    this.zoom_container.go_to(new_zoom, new_pos);
}

function zoom_to_text_label(text_label_id) {
    var text_label = this.text_labels[text_label_id],
        new_zoom = 0.5,
        size = this.get_size(),
        new_pos = { x: - text_label.x * new_zoom + size.width/2,
                    y: - text_label.y * new_zoom + size.height/2 };
    this.zoom_container.go_to(new_zoom, new_pos);
}

function highlight_reaction(reaction_id) {
    this.highlight(this.sel.selectAll('#r'+reaction_id).selectAll('text'));
}

function highlight_node(node_id) {
    this.highlight(this.sel.selectAll('#n'+node_id).selectAll('text'));
}

function highlight_text_label(text_label_id) {
    this.highlight(this.sel.selectAll('#l'+text_label_id).selectAll('text'));
}

function highlight(sel) {
    this.sel.selectAll('.highlight')
        .classed('highlight', false);
    if (sel !== null) {
        sel.classed('highlight', true);
    }
}

// -------------------------------------------------------------------------
// Full screen
// -------------------------------------------------------------------------

function full_screen_event () {
    if      (document.fullscreenEnabled)       return 'fullscreenchange'
    else if (document.mozFullScreenEnabled)    return 'mozfullscreenchange'
    else if (document.webkitFullscreenEnabled) return 'webkitfullscreenchange'
    else if (document.msFullscreenEnabled)     return 'MSFullscreenChange'
    else                                       return null
}

/**
 * Call the function when full screen is enabled.
 *
 * To unregister the event listener for the full screen event,
 * unlisten_for_full_screen.
 */
function listen_for_full_screen (fn) {
    document.addEventListener(full_screen_event(), fn)
    this.full_screen_listener = fn
}

/**
 * Remove the listener created by listen_for_full_screen.
 */
function unlisten_for_full_screen () {
    document.removeEventListener(full_screen_event(), this.full_screen_listener)
}

/**
 * Enter full screen if supported by the browser.
 */
function full_screen() {
    var sel = this.zoom_container.selection
    var e = sel.node()
    var d = document
    var full_screen_on = (d.fullscreenElement || d.mozFullScreenElement ||
                          d.webkitFullscreenElement || d.msFullscreenElement)
    if (full_screen_on) {
        // apply full heigh/width 100%
        sel.classed('full-screen-on', false)
        // exit
        if      (d.exitFullscreen)       d.exitFullscreen()
        else if (d.mozCancelFullScreen)  d.mozCancelFullScreen()
        else if (d.webkitExitFullscreen) d.webkitExitFullscreen()
        else if (d.msExitFullscreen)     d.msExitFullscreen()
        else throw Error('Cannot exit full screen')
    } else {
        sel.classed('full-screen-on', true)
        // enter
        if      (e.requestFullscreen)       e.requestFullscreen()
        else if (e.mozRequestFullScreen)    e.mozRequestFullScreen()
        else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
        else if (e.msRequestFullscreen)     e.msRequestFullscreen()
        else throw Error('Full screen does not seem to be supported on this system.')
    }
}

// -------------------------------------------------------------------------
// IO

function save() {
    utils.download_json(this.map_for_export(), this.map_name);
}


function map_for_export() {
    var out = [{ "map_name": this.map_name,
                 "map_id": this.map_id,
                 "map_description": this.map_description,
                 "homepage": "https://escher.github.io",
                 "schema": "https://escher.github.io/escher/jsonschema/1-0-0#"
               },
               { reactions: utils.clone(this.reactions),
                 nodes: utils.clone(this.nodes),
                 text_labels: utils.clone(this.text_labels),
                 canvas: this.canvas.size_and_location() }
              ];

    // remove extra data
    for (var r_id in out[1].reactions) {
        var reaction = out[1].reactions[r_id],
            new_reaction = {};
        ['name', 'bigg_id','reversibility', 'label_x', 'label_y',
         'gene_reaction_rule', 'genes', 'metabolites'
        ].forEach(function(attr) {
            new_reaction[attr] = reaction[attr];
        });
        new_reaction['segments'] = {};
        for (var s_id in reaction.segments) {
            var segment = reaction.segments[s_id],
                new_segment = {};
            ['from_node_id', 'to_node_id', 'b1', 'b2'
            ].forEach(function(attr) {
                new_segment[attr] = segment[attr];
            });
            new_reaction['segments'][s_id] = new_segment;
        }
        out[1].reactions[r_id] = new_reaction;
    }
    for (var n_id in out[1].nodes) {
        var node = out[1].nodes[n_id],
            new_node = {},
            attrs;
        if (node.node_type == 'metabolite') {
            attrs = ['node_type', 'x', 'y', 'bigg_id', 'name', 'label_x', 'label_y',
                     'node_is_primary'];
        } else {
            attrs = ['node_type', 'x', 'y'];
        }
        attrs.forEach(function(attr) {
            new_node[attr] = node[attr];
        });
        out[1].nodes[n_id] = new_node;
    }
    for (var t_id in out[1].text_labels) {
        var text_label = out[1].text_labels[t_id],
            new_text_label = {},
            attrs = ["x", "y", "text"];
        attrs.forEach(function(attr) {
            new_text_label[attr] = text_label[attr];
        });
        out[1].text_labels[t_id] = new_text_label;
    }
    // canvas
    var canvas_el = out[1].canvas,
        new_canvas_el = {},
        attrs = ["x", "y", "width", "height"];
    attrs.forEach(function(attr) {
        new_canvas_el[attr] = canvas_el[attr];
    });
    out[1].canvas = new_canvas_el;

    return out;
}

function save_map(obj, callback_before, callback_after, map_type) {
    /** Rescale the canvas and save as svg/png.

     */

    // run the before callback
    obj.callback_manager.run(callback_before);

    // turn ofo zoom and translate so that illustrator likes the map
    var window_scale = obj.zoom_container.window_scale,
        window_translate = obj.zoom_container.window_translate,
        canvas_size_and_loc = obj.canvas.size_and_location(),
        mouse_node_size_and_trans = {
            w: obj.canvas.mouse_node.attr('width'),
            h: obj.canvas.mouse_node.attr('height'),
            transform: obj.canvas.mouse_node.attr('transform')
        };

    obj.zoom_container._go_to_svg(1.0, { x: -canvas_size_and_loc.x, y: -canvas_size_and_loc.y }, function() {
        obj.svg.attr('width', canvas_size_and_loc.width);
        obj.svg.attr('height', canvas_size_and_loc.height);
        obj.canvas.mouse_node.attr('width', '0px');
        obj.canvas.mouse_node.attr('height', '0px');
        obj.canvas.mouse_node.attr('transform', null);

        // hide the segment control points
        var hidden_sel = obj.sel.selectAll('.multimarker-circle,.midmarker-circle,#canvas')
            .style('visibility', 'hidden');

        // do the export
        if(map_type == 'svg') {
            utils.download_svg('saved_map', obj.svg, true);
        } else if(map_type == 'png') {
            utils.download_png('saved_map', obj.svg, true);
        }

        // revert everything
        obj.zoom_container._go_to_svg(window_scale, window_translate, function() {
            obj.svg.attr('width', null);
            obj.svg.attr('height', null);
            obj.canvas.mouse_node.attr('width', mouse_node_size_and_trans.w);
            obj.canvas.mouse_node.attr('height', mouse_node_size_and_trans.h);
            obj.canvas.mouse_node.attr('transform', mouse_node_size_and_trans.transform);
            // unhide the segment control points
            hidden_sel.style('visibility', null);

            // run the after callback
            obj.callback_manager.run(callback_after);
        }.bind(obj));
    }.bind(obj));
}

function save_svg() {
    save_map(this, 'before_svg_export', 'after_svg_export', 'svg');
}

function save_png() {
    save_map(this, 'before_png_export', 'after_png_export', 'png');
}

function convert_map() {
    /** Assign the descriptive names and gene_reaction_rules from the model
     to the map.

     If no map is loaded, then throw an Error.

     If some reactions are not in the model, then warn in the status.

     */
    // run the before callback
    this.callback_manager.run('before_convert_map');

    // check the model
    if (!this.has_cobra_model()) throw Error('No COBRA model loaded.');
    var model = this.cobra_model;

    // ids for reactions and metabolites not found in the model
    var reactions_not_found = {},
        reaction_attrs = ['name', 'gene_reaction_rule', 'genes'],
        met_nodes_not_found = {},
        metabolite_attrs = ['name'],
        found;
    // convert reactions
    for (var reaction_id in this.reactions) {
        var reaction = this.reactions[reaction_id];
        found = false;
        // find in cobra model
        for (var model_reaction_id in model.reactions) {
            var model_reaction = model.reactions[model_reaction_id];
            if (model_reaction.bigg_id == reaction.bigg_id) {
                reaction_attrs.forEach(function(attr) {
                    reaction[attr] = model_reaction[attr];
                });
                found = true;
            }
        }
        if (!found)
            reactions_not_found[reaction_id] = true;
    }
    // convert metabolites
    for (var node_id in this.nodes) {
        var node = this.nodes[node_id];
        // only look at metabolites
        if (node.node_type != 'metabolite') continue;
        found = false;
        // find in cobra model
        for (var model_metabolite_id in model.metabolites) {
            var model_metabolite = model.metabolites[model_metabolite_id];
            if (model_metabolite.bigg_id == node.bigg_id) {
                metabolite_attrs.forEach(function(attr) {
                    node[attr] = model_metabolite[attr];
                });
                found = true;
            }
        }
        if (!found)
            met_nodes_not_found[node_id] = true;
    }

    // status
    var n_reactions_not_found = Object.keys(reactions_not_found).length,
        n_met_nodes_not_found = Object.keys(met_nodes_not_found).length,
        status_delay = 3000;
    if (n_reactions_not_found == 0 &&
        n_met_nodes_not_found == 0) {
        this.set_status('Successfully converted attributes.', status_delay);
    } else if (n_met_nodes_not_found == 0) {
        this.set_status('Converted attributes, but count not find ' + n_reactions_not_found +
                        ' reactions in the model.', status_delay);
        this.settings.set_conditional('highlight_missing', true);
    } else if (n_reactions_not_found == 0) {
        this.set_status('Converted attributes, but count not find ' + n_met_nodes_not_found +
                        ' metabolites in the model.', status_delay);
        this.settings.set_conditional('highlight_missing', true);
    } else {
        this.set_status('Converted attributes, but count not find ' + n_reactions_not_found +
                        ' reactions and ' + n_met_nodes_not_found + ' metabolites in the model.',
                        status_delay);
        this.settings.set_conditional('highlight_missing', true);
    }

    // redraw
    this.draw_everything();

    // run the after callback
    this.callback_manager.run('after_convert_map');
}

},{"./Behavior":1,"./CallbackManager":5,"./Canvas":6,"./Draw":10,"./KeyManager":11,"./Scale":15,"./SearchIndex":18,"./UndoStack":24,"./build":26,"./data_styles":28,"./utils":33,"baconjs":34,"underscore":38}],13:[function(require,module,exports){
/**
 * PlacedDiv. A container to position an html div to match the coordinates of a
 * SVG element.
 */

var utils = require('./utils')

var PlacedDiv = utils.make_class()
// instance methods
PlacedDiv.prototype = {
  init: init,
  is_visible: is_visible,
  place: place,
  hide: hide,
}
module.exports = PlacedDiv

function init (div, map, displacement) {
  this.div = div
  this.map = map
  this.displacement = displacement === undefined ? { x: 0, y: 0 } : displacement

  this.visible = false
}

function is_visible () {
  return this.visible
}

/**
 * Position the html div to match the given SVG coordinates.
 */
function place (coords) {
  // show the input
  this.div.style('display', null)

  // move the new input
  var window_translate = this.map.zoom_container.window_translate
  var window_scale = this.map.zoom_container.window_scale
  var map_size = this.map.get_size()
  var left = Math.max(20,
                      Math.min(map_size.width - 270,
                               (window_scale * coords.x + window_translate.x -
                                this.displacement.x)))
  var top = Math.max(20,
                     Math.min(map_size.height - 40,
                              (window_scale * coords.y + window_translate.y -
                               this.displacement.y)))
  this.div.style('position', 'absolute')
    .style('display', 'block')
    .style('left', left+'px')
    .style('top', top+'px')

  this.visible = true
}

/**
 * Hide the PlacedDiv.
 */
function hide () {
  if (this.visible) {
    this.div.style('display', 'none')
    this.visible = false
  }
}

},{"./utils":33}],14:[function(require,module,exports){
/** A QuickJump menu to move between maps.

 Arguments
 ---------

 sel: The d3 selection of an html node to place the menu inside.

 options: An array of map names to jump to.

 load_callback: A callback function that accepts two arguments: map_name,
 and another callback which returns true or false for success or failure
 (callback purgatory).

 */

var utils = require('./utils');


var QuickJump = utils.make_class();
// instance methods
QuickJump.prototype = {
    init: init,
    reset_selection: reset_selection,
    replace_state_for_map_name: replace_state_for_map_name
};
module.exports = QuickJump;


// instance methods
function init(sel, load_callback) {
    // set up the menu
    var select_sel = sel.append('select')
            .attr('id', 'quick-jump-menu')
            .attr('class', 'form-control');
    this.selector = select_sel;

    // get the options to show
    var url_comp = utils.parse_url_components(window),
        current = ('map_name' in url_comp) ? url_comp.map_name : null,
        quick_jump_path = ('quick_jump_path' in url_comp) ? url_comp.quick_jump_path : null,
        options = ('quick_jump' in url_comp) ? url_comp.quick_jump : [],
        default_value = '— Jump to map —',
        view_options = [default_value].concat(options);
    if (current !== null) {
        view_options = view_options.filter(function(o) {
            return o != current;
        });
    }

    select_sel.selectAll('option')
        .data(view_options)
        .enter()
        .append('option')
        .text(function(d) {
            // works whether or not a '.' is present
            return d.split('.').slice(-1)[0];
        });

    // only show if there are options
    select_sel.style('display', view_options.length > 1 ? 'block' : 'none');

    // on selection
    var change_map = function(map_name) {
        load_callback(map_name, quick_jump_path, function(success) {
            if (success)
                this.replace_state_for_map_name(map_name);
            else
                this.reset_selection();
        }.bind(this));
    }.bind(this);

    select_sel.on('change', function() {
        // get the new map
        var map_name = this.options[this.selectedIndex].__data__;
        change_map(map_name);
    });
}

function reset_selection() {
    this.selector.node().selectedIndex = 0;
}

function replace_state_for_map_name(map_name) {
    /** Just changes the url to match the new map name. Does not actually
     manage the HTML5 history.

     */

    // update the url with the new map
    var url = window.location.href
            .replace(/(map_name=)([^&]+)(&|$)/, '$1' + map_name + '$3');
    window.history.replaceState('Not implemented', '', url);
}

},{"./utils":33}],15:[function(require,module,exports){
/** Scale */

/* global d3 */

var utils = require('./utils');


var Scale = utils.make_class();
Scale.prototype = {
    init: init,
    connect_to_settings: connect_to_settings
};
module.exports = Scale;


function init() {
    this.x = d3.scale.linear();
    this.y = d3.scale.linear();
    this.x_size = d3.scale.linear();
    this.y_size = d3.scale.linear();
    this.size = d3.scale.linear();
    this.reaction_color = d3.scale.linear().clamp(true);
    this.reaction_size = d3.scale.linear().clamp(true);
    this.metabolite_color = d3.scale.linear().clamp(true);
    this.metabolite_size = d3.scale.linear().clamp(true);
    this.scale_path = function(path) {
        var x_fn = this.x, y_fn = this.y;
        // TODO: scale arrow width
        var str = d3.format(".2f"),
            path = path.replace(/(M|L)([0-9-.]+),?\s*([0-9-.]+)/g, function (match, p0, p1, p2) {
                return p0 + [str(x_fn(parseFloat(p1))), str(y_fn(parseFloat(p2)))].join(', ');
            }),
            reg = /C([0-9-.]+),?\s*([0-9-.]+)\s*([0-9-.]+),?\s*([0-9-.]+)\s*([0-9-.]+),?\s*([0-9-.]+)/g;
        path = path.replace(reg, function (match, p1, p2, p3, p4, p5, p6) {
            return 'C'+str(x_fn(parseFloat(p1)))+','+
                str(y_fn(parseFloat(p2)))+' '+
                str(x_fn(parseFloat(p3)))+','+
                str(y_fn(parseFloat(p4)))+' '+
                [str(x_fn(parseFloat(p5)))+','+str(y_fn(parseFloat(p6)))];
        });
        return path;
    }.bind(this);
    this.scale_decimals = function(path, scale_fn, precision) {
        var str = d3.format("."+String(precision)+"f");
        path = path.replace(/([0-9.]+)/g, function (match, p1) {
            return str(scale_fn(parseFloat(p1)));
        });
        return path;
    };
}

function connect_to_settings(settings, map, get_data_statistics) {
    // domains
    var update_reaction = function(s) {
        var out = sort_scale(s, get_data_statistics()['reaction']);
        this.reaction_color.domain(out.domain);
        this.reaction_size.domain(out.domain);
        this.reaction_color.range(out.color_range);
        this.reaction_size.range(out.size_range);
    }.bind(this);
    var update_metabolite = function(s) {
        var out = sort_scale(s, get_data_statistics()['metabolite']);
        this.metabolite_color.domain(out.domain);
        this.metabolite_size.domain(out.domain);
        this.metabolite_color.range(out.color_range);
        this.metabolite_size.range(out.size_range);
    }.bind(this);

    // scale changes
    settings.streams['reaction_scale'].onValue(update_reaction);
    settings.streams['metabolite_scale'].onValue(update_metabolite);
    // stats changes
    map.callback_manager.set('calc_data_stats__reaction', function(changed) {
        if (changed) update_reaction(settings.get_option('reaction_scale'));
    });
    map.callback_manager.set('calc_data_stats__metabolite', function(changed) {
        if (changed) update_metabolite(settings.get_option('metabolite_scale'));
    });

    // definitions
    function sort_scale(scale, stats) {
        var sorted = scale.map(function(x) {
            var v;
            if (x.type in stats)
                v = stats[x.type];
            else if (x.type == 'value')
                v = x.value;
            else
                throw new Error('Bad domain type ' + x.type);
            return { v: v,
                     color: x.color,
                     size: x.size };
        }).sort(function(a, b) {
            return a.v - b.v;
        });
        return { domain: sorted.map(function(x) { return x.v; }),
                 color_range: sorted.map(function(x) { return x.color; }),
                 size_range: sorted.map(function(x) { return x.size; }) };
    }
}

},{"./utils":33}],16:[function(require,module,exports){
/** ScaleEditor. An interactive UI to edit color and size scales.

 Attributes
 ----------

 sel: A d3 selection.

 type: A type, that should be unique on the page.

 settings: The Settings object.

 */

/* global d3 */

var utils = require('./utils');
var bacon = require('baconjs');


var ScaleEditor = utils.make_class();
// instance methods
ScaleEditor.prototype = {
    init: init,
    update: update,
    update_no_data: update_no_data,
    _data_not_loaded: _data_not_loaded
};
module.exports = ScaleEditor;


// instance methods
function init(sel, type, settings, get_data_statistics) {
    // sels
    var grad_id = 'grad' + type + this.unique_string;
    this.w = 400;
    this.h = 30;
    this.x = 20;
    this.input_width = 90;
    this.input_height = 24;
    var b = sel.append('div')
            .attr('class', 'scale-editor');
    // no data loaded
    this.data_not_loaded = b.append('div')
        .attr('class', 'data-not-loaded')
        .text((type == 'reaction' ? 'Reaction and gene' : 'Metabolite') + ' data not loaded');
    // label
    this.input_label_group = b.append('div')
        .attr('class', 'input-label-group');
    // no data
    var nd = b.append('div')
            .style('top', this.input_height * 3 + 56 + 10 + 'px')
            .attr('class', 'no-data');
    nd.append('span').text('Styles for ' + type + 's with no data')
        .attr('class', 'no-data-heading');
    this.no_data_container = nd.append('div');
    var c = b.append('div')
            .attr('class', 'centered');
    this.add_group = c.append('div');
    this.trash_group = c.append('div')
        .attr('class', 'trash-container');
    var svg = c.append('svg')
            .attr('class', 'scale-svg');
    this.input_group = c.append('div')
        .attr('class', 'input-container');
    this.gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', grad_id);
    svg.append('rect')
        .attr('class', 'rect')
        .attr('fill', 'url(#' + grad_id + ')')
        .attr('width', this.w + 'px')
        .attr('height', this.h + 'px')
        .attr('x', this.x + 'px'),
    this.pickers_group = svg.append('g');

    // settings
    this.type = type;
    this.settings = settings;
    this.get_data_statistics = get_data_statistics;

    var unique_map_id = this.settings.get_option('unique_map_id');
    this.unique_string = (unique_map_id === null ? '' : '.' + unique_map_id);

    // collect data
    this.no_data = {};
    ['color', 'size'].forEach(function(s) {
        this.no_data[s] = null;
        this.settings.streams[this.type + '_no_data_' + s].onValue(function(val) {
            this.no_data[s] = val;
            this.update_no_data();
        }.bind(this));
    }.bind(this));

    this.settings.streams[type + '_scale'].onValue(function(scale) {
        this.scale = scale;
        this.update();
    }.bind(this));
}

function update() {
    var scale = this.scale,
        stats = this.get_data_statistics()[this.type],
        bar_w = 14,
        bar_h = 35,
        x_disp = this.x,
        data_not_loaded = this._data_not_loaded();

    // Must have max and min. Otherwise, assume that no data is loaded.
    if (data_not_loaded) {
        scale = [{ type: 'min', 'color': null, 'size': null },
                 { type: 'max', 'color': null, 'size': null }];
        stats = { 'min': 0, 'max': 1 };
    }

    var sc = d3.scale.linear()
            .domain([0, this.w])
            .range([stats.min, stats.max]),
        sc_size = d3.scale.linear()
            .domain([0, this.w])
            .range([0, stats.max - stats.min]);

    // ---------------------------------------------------------------------
    // convenience functions
    var bring_to_front = function(d, i) {
        // bring an input set to the front
        this.input_group.selectAll('.input-set').each(function(d2) {
            d3.select(this).classed('selected-set', d === d2);
        });
    }.bind(this);

    var get_this_val = function(d) {
        return (d.type == 'value') ? d.value : stats[d.type];
    };

    var set_scale = function(scale) {
        this.settings.set_conditional(this.type + '_scale', scale);
        this.scale = scale;
        this.update();
    }.bind(this);

    // ---------------------------------------------------------------------
    // make the gradient
    var sorted_domain = scale.map(function(d) {
        return { frac: (get_this_val(d) - stats.min) / (stats.max - stats.min),
                 color: d.color };
    }).filter(function(d) {
        return (d.frac >= 0 && d.frac <= 1.0);
    }).sort(function(a, b) {
        return a.frac - b.frac;
    });
    var stops = this.gradient.selectAll('stop')
            .data(sorted_domain);
    stops.enter()
        .append('stop');
    stops.attr('offset', function(d) {
        return d.frac * 100 + '%';
    }).style('stop-color', function (d) {
        return d.color === null ? '#F1ECFA' : d.color;
    });
    stops.exit().remove();

    // ---------------------------------------------------------------------
    // no data sign

    this.data_not_loaded.style('visibility', (data_not_loaded ? null : 'hidden'));

    // ---------------------------------------------------------------------
    // make the pickers
    var pickers = this.pickers_group
            .selectAll('.picker')
            .data(scale);
    // drag
    var drag = d3.behavior.drag();
    drag.on('drag', function(d, i) {
        // on drag, make it a value type
        if (['value', 'min', 'max'].indexOf(scale[i].type) === -1) {
            // get the current value and set it
            scale[i].value = get_this_val(d);
            scale[i].type = 'value';
        }
        // change the model on drag
        var new_d = scale[i].value + sc_size(d3.event.dx),
            buf = sc_size(bar_w + 2);
        if (new_d > stats.max - buf) new_d = stats.max - buf;
        if (new_d < stats.min + buf) new_d = stats.min + buf;
        // round to 2 decimals
        new_d = Math.floor(new_d * 100.0) / 100.0;
        scale[i].value = new_d;
        this.settings.set_conditional(this.type + '_scale', scale);
        this.scale = scale;
        this.update();
    }.bind(this));
    // enter
    pickers.enter()
        .append('g')
        .attr('class', 'picker')
        .style('cursor', 'pointer')
        .append('rect');
    // update
    pickers.select('rect')
        .attr('x', function(d, i) {
            var val = get_this_val(d),
                buf = bar_w + 2;
            if (d.type == 'value' && val <= stats.min)
                return sc.invert(stats.min) - (bar_w / 2) + x_disp - buf;
            if (d.type == 'value' && val >= stats.max)
                return sc.invert(stats.max) - (bar_w / 2) + x_disp + buf;
            return sc.invert(val) - (bar_w / 2) + x_disp;
        })
        .attr('width', bar_w + 'px')
        .attr('height', bar_h + 'px')
        .call(drag)
        .on('mousedown', bring_to_front);
    // exit
    pickers.exit().remove();

    // ---------------------------------------------------------------------
    // make the delete buttons
    var trashes = this.trash_group.selectAll('span')
            .data(scale);
    // enter
    trashes.enter()
        .append('span');
    // update
    trashes.attr('class', function(d, i) {
        if (d.type == 'min' || d.type == 'max')
            return null;
        return 'trash glyphicon glyphicon-trash';
    }).style('left', function(d) {
        return sc.invert(get_this_val(d)) - (bar_w / 2) + x_disp + 'px';
    }).on('click', function (d, i) {
        if (d.type == 'min' || d.type == 'max')
            return;
        scale = scale.slice(0, i).concat(scale.slice(i + 1));
        this.settings.set_conditional(this.type + '_scale', scale);
        this.scale = scale;
        this.update();
    }.bind(this));
    // exit
    trashes.exit().remove();

    // ---------------------------------------------------------------------
    // make the add button
    var add = this.add_group.selectAll('.add')
            .data(['add']);
    // enter
    add.enter()
        .append('span')
        .attr('class', 'add glyphicon glyphicon-plus');
    // update
    add.on('click', function (d) {
        if (data_not_loaded) return;

        var new_d = (stats.max + stats.min) / 2,
            buf = sc_size(bar_w + 2),
            last_ind = 0;
        // try to make the new point not overlap
        for (var j = 0, l = scale.length; j < l; j++) {
            var th = get_this_val(scale[j]);
            if (Math.abs(th - new_d) < buf) {
                new_d = new_d + buf;
                if (new_d > stats.max - buf) new_d = stats.max - buf;
                if (new_d < stats.min + buf) new_d = stats.min + buf;
            }
            if (new_d > th)
                last_ind = j;
        }
        // add
        scale.push({ type: 'value',
                     value: new_d,
                     color: scale[last_ind].color,
                     size: scale[last_ind].size });
        set_scale(scale);
    }.bind(this));
    // exit
    add.exit().remove();

    // ---------------------------------------------------------------------
    // input labels
    var labels = this.input_label_group.selectAll('.row-label')
            .data(['Value:', 'Color:', 'Size:']);
    // enter
    labels.enter().append('div')
        .attr('class', 'row-label')
        .style('height', this.input_height + 'px')
        .style('line-height', this.input_height + 'px');
    // update
    labels
        .style('top', function(d, i) {
            return 56 + (i * this.input_height) + 'px';
        }.bind(this))
        .text(function(d) { return d; });
    // exit
    labels.exit().remove();

    // ---------------------------------------------------------------------
    // inputs
    var inputs = this.input_group.selectAll('.input-set')
            .data(scale);

    // enter
    var i = inputs.enter()
            .append('div')
            .attr('class', 'input-set');
    i.append('input')
        .attr('class', 'domain-input')
        .style('width', this.input_width + 'px');
    // type picker
    i.append('select')
        .attr('class', 'domain-type-picker'),
    // color input
    i.append('input')
        .attr('class', 'color-input')
        .style('width', this.input_width + 'px');
    i.append('input')
        .attr('type', 'color')
        .style('visibility', function() {
            // hide the input if the HTML5 color picker is not supported
            return (this.type == 'text') ? 'hidden' : null;
        })
        .attr('class', 'color-picker');
    i.append('input')
        .attr('class', 'size-input')
        .style('width', this.input_width + 'px');

    // update
    inputs.style('height', this.input_height * 3 + 'px')
        .style('width', this.input_width + 'px')
        .style('left', function(d) {
            var val = get_this_val(d),
                buf = bar_w + 2,
                l;
            if (d.type == 'value' && val <= stats.min)
                l = sc.invert(stats.min) - (bar_w / 2) + x_disp - buf;
            else if (d.type == 'value' && val >= stats.max)
                l = sc.invert(stats.max) - (bar_w / 2) + x_disp + buf;
            else
                l = sc.invert(val) - (bar_w / 2) + x_disp;
            // don't go over the right edge of the bar
            if (l + this.input_width > this.w + this.x)
                l = l - this.input_width + (bar_w / 2);
            return l + 'px';
        }.bind(this))
        .on('mousedown', bring_to_front);

    var format = d3.format('.4g');
    inputs.select('.domain-input')
        .style('height', this.input_height + 'px')
        .each(function (d, i) {
            if (d.type == 'value') {
                this.value = get_this_val(d);
                this.disabled = false;
            } else {
                this.value = d.type + ' (' + format(get_this_val(d)) + ')';
                this.disabled = true;
            }
        }).on('change', function(d, i) {
            var buf = sc_size(bar_w + 2),
                new_d = parseFloat(this.value);
            scale[i].value = new_d;
            set_scale(scale);
        });
    // update type picker
    var select = inputs.select('.domain-type-picker'),
        // get the function types, except min and max
        stat_types = (['value'].concat(Object.keys(stats))
                      .filter(function(x) {
                          return x != 'min' && x != 'max';
                      })),
        opts = select.selectAll('option').data(stat_types);
    opts.enter().append('option');
    opts.attr('value', function(d) { return d; })
        .text(function(d) { return d; });
    opts.exit().remove();
    select.style('visibility', function(d) {
        return (d.type == 'min' || d.type == 'max') ? 'hidden' : null;
    })
        .style('left', (this.input_width - 20) + 'px')
        .style('width', '20px')
        .each(function (d, i) {
            var sind = 0;
            d3.select(this).selectAll('option').each(function(_, i) {
                if (this.value == d.type)
                    sind = i;
            });
            this.selectedIndex = sind;
        }).on('change', function(d, i) {
            // set the value to the current location
            if (this.value == 'value')
                scale[i].value = stats[d.type];
            // switch to the new type
            scale[i].type = this.value;
            // reload
            set_scale(scale);
        });
    // update color input
    inputs.select('.color-input')
        .style('height', this.input_height + 'px')
        .style('top', this.input_height + 'px')
        .each(function (d, i) {
            this.value = (d.color === null ? '' : d.color);
            this.disabled = (d.color === null);
        }).on('change', function(d, i) {
            scale[i].color = this.value;
            set_scale(scale);
        });
    inputs.select('.color-picker')
        .style('left', (this.input_width - this.input_height) + 'px')
        .style('top', this.input_height + 'px')
        .style('width', this.input_height + 'px')
        .style('height', this.input_height + 'px')
        .each(function (d, i) {
            this.value = (d.color === null ? '#dddddd' : d.color);
            this.disabled = (d.color === null);
        }).on('change', function(d, i) {
            scale[i].color = this.value;
            set_scale(scale);
        });
    inputs.select('.size-input')
        .style('height', this.input_height + 'px')
        .style('top', this.input_height * 2 + 'px')
        .each(function (d, i) {
            this.value = (d.size === null ? '' : d.size);
            this.disabled = (d.size === null);
        }).on('change', function(d, i) {
            scale[i].size = parseFloat(this.value);
            set_scale(scale);
        });

    // exit
    inputs.exit().remove();
}

function update_no_data() {
    var no_data = this.no_data,
        data_not_loaded = this._data_not_loaded(),
        label_w = 40;

    var ins = this.no_data_container
            .selectAll('.input-group')
            .data([['color', 'Color:'], ['size', 'Size:']]);
    // enter
    var t = ins.enter().append('div')
            .attr('class', 'input-group');
    t.append('span');
    t.append('input');
    t.append('input')
        .attr('type', 'color')
        .style('visibility', function(d) {
            // hide the input if the HTML5 color picker is not supported,
            // or if this is a size box
            return (this.type == 'text' || d[0] != 'color') ? 'hidden' : null;
        })
        .attr('class', 'color-picker');
    // update
    ins.select('span')
        .text(function(d) { return d[1]; })
        .style('height', this.input_height + 'px')
        .style('line-height', this.input_height + 'px')
        .style('left', function(d, i) {
            return ((label_w + this.input_width + 10) * i) + 'px';
        }.bind(this));
    var get_o = function(kind) {
        return this.settings.get_option(this.type + '_no_data_' + kind);
    }.bind(this);
    ins.select('input')
        .style('left', function(d, i) {
            return (label_w + (label_w + this.input_width + 10) * i) + 'px';
        }.bind(this))
        .style('height', this.input_height + 'px')
        .style('width', this.input_width + 'px')
        .each(function(d) {
            // initial value
            this.value = data_not_loaded ? '' : no_data[d[0]];
            this.disabled = data_not_loaded;
        })
        .on('change', function(d) {
            var val = d3.event.target.value;
            if (d[0] == 'size')
                val = parseFloat(val);
            this.no_data[d[0]] = val;
            this.settings.set_conditional(this.type + '_no_data_' + d[0], val);
            this.update_no_data();
        }.bind(this));
    ins.select('.color-picker')
        .style('left', function(d, i) {
            return ((label_w + this.input_width) * (i + 1) - this.input_height) + 'px';
        }.bind(this))
        .style('width', this.input_height + 'px')
        .style('height', this.input_height + 'px')
        .each(function (d, i) {
            this.value = data_not_loaded ? '#dddddd' : no_data[d[0]];
            this.disabled = data_not_loaded;
        })
        .on('change', function(d, i) {
            var val = d3.event.target.value;
            this.no_data[d[0]] = val;
            this.settings.set_conditional(this.type + '_no_data_' + d[0], val);
            this.update_no_data();
        }.bind(this));
    // exit
    ins.exit().remove();
}

function _data_not_loaded() {
    var stats = this.get_data_statistics()[this.type];
    return (stats.max === null || stats.min === null);
}

},{"./utils":33,"baconjs":34}],17:[function(require,module,exports){
/** SearchBar */

var utils = require('./utils');
var CallbackManager = require('./CallbackManager');
var _ = require('underscore');

var SearchBar = utils.make_class();
// instance methods
SearchBar.prototype = {
    init: init,
    is_visible: is_visible,
    toggle: toggle,
    update: update,
    next: next,
    previous: previous
};
module.exports = SearchBar;

function init(sel, search_index, map) {
    var container = sel.attr('class', 'search-container')
            .style('display', 'none');
    this.input = container.append('input')
        .attr('class', 'search-bar');
    var group = container.append('div').attr('class', 'btn-group btn-group-sm');
    group.append('button')
        .attr('class', 'btn btn-default')
        .on('click', this.previous.bind(this))
        .append('span').attr('class', 'glyphicon glyphicon-chevron-left');
    group.append('button')
        .attr('class', 'btn btn-default')
        .on('click', this.next.bind(this))
        .append('span').attr('class', 'glyphicon glyphicon-chevron-right');
    this.counter = container.append('div')
        .attr('class', 'search-counter');
    container.append('button')
        .attr('class', 'btn btn-sm btn-default close-button')
        .on('click', function() {
            this.toggle(false);
        }.bind(this))
        .append('span').attr('class',  'glyphicon glyphicon-remove');

    this.callback_manager = new CallbackManager();

    this.selection = container;
    this.map = map;
    this.search_index = search_index;

    this.current = 1;
    this.results = null;

    var on_input_fn = function(input) {
        this.current = 1;
        this.results = _drop_duplicates(this.search_index.find(input.value));
        this.update();
    }.bind(this, this.input.node());
    this.input.on('input', utils.debounce(on_input_fn, 200));
}

var comp_keys = {
    metabolite: ['m', 'node_id'],
    reaction: ['r', 'reaction_id'],
    text_label: ['t', 'text_label_id']
};
function _drop_duplicates(results) {
    return _.uniq(results, function(item) {
        // make a string for fast comparison
        var t = comp_keys[item.type];
        return t[0] + item[t[1]];
    });
}

function is_visible() {
    return this.selection.style('display') !== 'none';
}

function toggle(on_off) {
    if (on_off===undefined) this.is_active = !this.is_active;
    else this.is_active = on_off;

    if (this.is_active) {
        this.selection.style('display', null);
        this.counter.text('');
        this.input.node().value = '';
        this.input.node().focus();
        // escape key
        this.clear_escape = this.map.key_manager
            .add_escape_listener(function() {
                this.toggle(false);
            }.bind(this), true);
        // next keys
        this.clear_next = this.map.key_manager
            .add_key_listener(['enter', 'ctrl+g'], function() {
                this.next();
            }.bind(this), false);
        // previous keys
        this.clear_previous = this.map.key_manager
            .add_key_listener(['shift+enter', 'shift+ctrl+g'], function() {
                this.previous();
            }.bind(this), false);
        // run the show callback
        this.callback_manager.run('show');
    } else {
        this.map.highlight(null);
        this.selection.style('display', 'none');
        this.results = null;
        if (this.clear_escape) this.clear_escape();
        this.clear_escape = null;
        if (this.clear_next) this.clear_next();
        this.clear_next = null;
        if (this.clear_previous) this.clear_previous();
        this.clear_previous = null;
        // run the hide callback
        this.callback_manager.run('hide');
    }
}

function update() {
    if (this.results === null) {
        this.counter.text('');
        this.map.highlight(null);
    } else if (this.results.length === 0) {
        this.counter.text('0 / 0');
        this.map.highlight(null);
    } else {
        this.counter.text(this.current + ' / ' + this.results.length);
        var r = this.results[this.current - 1];
        if (r.type=='reaction') {
            this.map.zoom_to_reaction(r.reaction_id);
            this.map.highlight_reaction(r.reaction_id);
        } else if (r.type=='metabolite') {
            this.map.zoom_to_node(r.node_id);
            this.map.highlight_node(r.node_id);
        } else if (r.type=='text_label') {
            this.map.zoom_to_text_label(r.text_label_id);
            this.map.highlight_text_label(r.text_label_id);
        } else {
            throw new Error('Bad search index data type: ' + r.type);
        }
    }
}

function next() {
    if (this.results === null) return;
    if (this.current === this.results.length)
        this.current = 1;
    else
        this.current += 1;
    this.update();
}

function previous() {
    if (this.results === null) return;
    if (this.current === 1)
        this.current = this.results.length;
    else
        this.current -= 1;
    this.update();
}

},{"./CallbackManager":5,"./utils":33,"underscore":38}],18:[function(require,module,exports){
/** SearchIndex. Define an index for searching for reaction and metabolites in
 the map.

 The index is stored in SearchIndex.index, an object of id/record pairs.

 */

var utils = require('./utils');

var SearchIndex = utils.make_class();
SearchIndex.prototype = {
    init: init,
    insert: insert,
    remove: remove,
    find: find
};
module.exports = SearchIndex;


function init() {
    this.index = {};
}

function insert(id, record, overwrite, check_record) {
    /** Insert a record into the index.

     id: A unique string id.

     record: Records have the form:

     { 'name': '',
     'data': {} }

     Search is performed on substrings of the name.

     overwrite: (Default false) For faster performance, make overwrite true,
     and records will be inserted without checking for an existing record.

     check_record: (Default false) For faster performance, make check_record
     false. If true, records will be checked to make sure they have name and
     data attributes.

     Returns undefined.

     */
    if (!overwrite && (id in this.index))
        throw new Error("id is already in the index");
    if (check_record && !(('name' in record) && ('data' in record)))
        throw new Error("malformed record");
    this.index[id] = record;
}

function remove(record_id) {
    /** Remove the matching record.

     Returns true is a record is found, or false if no match is found.

     */
    if (record_id in this.index) {
        delete this.index[record_id];
        return true;
    } else {
        return false;
    }
}

function find(substring) {
    /** Find a record that matches the substring.

     Returns an array of data from matching records.

     */

    var re = RegExp(substring, "i"), // ignore case
        matches = [];
    for (var id in this.index) {
        var record = this.index[id];
        if (re.exec(record.name))
            matches.push(record.data);
    }
    return matches;
}

},{"./utils":33}],19:[function(require,module,exports){
/** Settings. A class to manage settings for a Map.

 Arguments
 ---------

 set_option: A function, fn(key), that returns the option value for the
 key.

 get_option: A function, fn(key, value), that sets the option for the key
 and value.

 conditional_options: The options to that are conditionally accepted when
 changed. Changes can be abandoned by calling abandon_changes(), or accepted
 by calling accept_changes().

 */

/* global d3 */

var utils = require('./utils');

var bacon = require('baconjs');


var Settings = utils.make_class();
// instance methods
Settings.prototype = {
    init: init,
    set_conditional: set_conditional,
    hold_changes: hold_changes,
    abandon_changes: abandon_changes,
    accept_changes: accept_changes
};
module.exports = Settings;


// instance methods
function init (set_option, get_option, conditional_options) {
  this.set_option = set_option
  this.get_option = get_option

  // manage accepting/abandoning changes
  this.status_bus = new bacon.Bus()

  // force an update of ui components
  this.force_update_bus = new bacon.Bus()

  // modify bacon.observable
  bacon.Observable.prototype.convert_to_conditional_stream = _convert_to_conditional_stream
  bacon.Observable.prototype.force_update_with_bus = _force_update_with_bus

  // create the options
  this.busses = {}
  this.streams = {}
  for (var i = 0, l = conditional_options.length; i < l; i++) {
    var name = conditional_options[i]
    var out = _create_conditional_setting(name, get_option(name), set_option,
                                          this.status_bus,
                                          this.force_update_bus)
    this.busses[name] = out.bus
    this.streams[name] = out.stream
  }
}

/**
 * Hold on to event when hold_property is true, and only keep them if
 * accept_property is true (when hold_property becomes false).
 */
function _convert_to_conditional_stream (status_stream) {

    // true if hold is pressed
    var is_not_hold_event = status_stream
            .map(function(x) { return x=='hold'; })
            .not()
            .toProperty(true),
        is_not_first_clear = status_stream
            .scan(false, function(c, x) {
                // first clear only
                return (c==false && (x=='accepted' || x=='rejected'));
            }).not(),
        is_not_first_hold = status_stream
            .scan(false, function(c, x) {
                // first clear only
                return (c==false && x=='hold');
            }).not(),
        combined = bacon.combineAsArray(this, status_stream),
        held = combined
            .scan([], function(c, x) {
                if (x[1]=='hold') {
                    c.push(x[0]);
                    return c;
                } else if (x[1]=='accept') {
                    return c;
                } else if (x[1]=='reject') {
                    return [];
                } else if (x[1]=='rejected' || x[1]=='accepted') {
                    return [x[0]];
                } else {
                    throw Error('bad status ' + x[1]);
                }
            })
    // don't pass in events until the end of a hold
            .filter(is_not_hold_event)
    // ignore the event when clear is passed
            .filter(is_not_first_clear)
    // ignore the event when hold is passed
            .filter(is_not_first_hold)
            .flatMap(function(ar) {
                return bacon.fromArray(ar);
            }),
        unheld = this.filter(is_not_hold_event);
    return unheld.merge(held);
}

function _force_update_with_bus(bus) {
    return bacon
        .combineAsArray(this, bus.toProperty(false))
        .map(function(t) {
            return t[0];
        });
}

function _create_conditional_setting(name, initial_value, set_option,
                                     status_bus, force_update_bus) {
    // set up the bus
    var bus = new bacon.Bus();
    // make the event stream
    var stream = bus
    // conditionally accept changes
            .convert_to_conditional_stream(status_bus)
    // force updates
            .force_update_with_bus(force_update_bus);

    // get the latest
    stream.onValue(function(v) {
        set_option(name, v);
    });

    // push the initial value
    bus.push(initial_value);

    return { bus: bus, stream: stream };
}

function set_conditional(name, value) {
    /** Set the value of a conditional setting, one that will only be
     accepted if this.accept_changes() is called.

     Arguments
     ---------

     name: The option name

     value: The new value

     */

    if (!(name in this.busses))
        throw new Error('Invalid setting name');
    this.busses[name].push(value);
}

function hold_changes() {
    this.status_bus.push('hold');
}

function abandon_changes() {
    this.status_bus.push('reject');
    this.status_bus.push('rejected');
    this.force_update_bus.push(true);
}

function accept_changes() {
    this.status_bus.push('accept');
    this.status_bus.push('accepted');
}

},{"./utils":33,"baconjs":34}],20:[function(require,module,exports){
/**
 * SettingsMenu
 */

var utils = require('./utils')
var CallbackManager = require('./CallbackManager')
var ScaleEditor = require('./ScaleEditor')

var SettingsMenu = utils.make_class()
SettingsMenu.prototype = {
  init: init,
  is_visible: is_visible,
  toggle: toggle,
  hold_changes: hold_changes,
  abandon_changes: abandon_changes,
  accept_changes: accept_changes,
  style_gui: style_gui,
  view_gui: view_gui,
}
module.exports = SettingsMenu

function init (sel, settings, map, toggle_abs_and_apply_data) {
  this.sel = sel
  this.settings = settings
  this.draw = false

  var unique_map_id = this.settings.get_option('unique_map_id')
  this.unique_string = (unique_map_id === null ? '' : '.' + unique_map_id)

  var background = sel.append('div')
    .attr('class', 'settings-box-background')
    .style('display', 'none')
  var container = background.append('div')
    .attr('class', 'settings-box-container')
    .style('display', 'none')

  // done button
  container.append('button')
    .attr("class", "btn btn-sm btn-default settings-button")
    .on('click', function () {
      this.accept_changes()
    }.bind(this))
    .append("span").attr("class",  "glyphicon glyphicon-ok")
  // quit button
  container.append('button')
    .attr("class", "btn btn-sm btn-default settings-button settings-button-close")
    .on('click', function () {
      this.abandon_changes()
    }.bind(this))
    .append("span").attr("class",  "glyphicon glyphicon-remove")

  var box = container.append('div')
    .attr('class', 'settings-box')

  // Tip
  box.append('div')
    .text('Tip: Hover over an option to see more details about it.')
    .classed('settings-tip', true)
  box.append('hr')

  // view and build
  box.append('div').text('View and build options')
    .attr('class', 'settings-section-heading-large')
  this.view_gui(box.append('div'))

  // reactions
  box.append('hr')
  box.append('div')
    .text('Reactions').attr('class', 'settings-section-heading-large')
  var rse = new ScaleEditor(box.append('div'), 'reaction', this.settings,
                            map.get_data_statistics.bind(map))
  map.callback_manager.set('calc_data_stats__reaction', function (changed) {
    if (changed) {
      rse.update()
      rse.update_no_data()
    }
  })
  box.append('div')
    .text('Reaction or Gene data').attr('class', 'settings-section-heading')
  this.style_gui(box.append('div'), 'reaction', function (on_off) {
    if (toggle_abs_and_apply_data) {
      toggle_abs_and_apply_data('reaction', on_off)
      rse.update()
      rse.update_no_data()
    }
  })

  // metabolite data
  box.append('hr')
  box.append('div').text('Metabolites')
    .attr('class', 'settings-section-heading-large')
  var mse = new ScaleEditor(box.append('div'), 'metabolite', this.settings,
                            map.get_data_statistics.bind(map))
  map.callback_manager.set('calc_data_stats__metabolite', function (changed) {
    if (changed) {
      mse.update()
      mse.update_no_data()
    }
  })
  box.append('div').text('Metabolite data')
    .attr('class', 'settings-section-heading')
  this.style_gui(box.append('div'), 'metabolite', function (on_off) {
    if (toggle_abs_and_apply_data) {
      toggle_abs_and_apply_data('metabolite', on_off)
      mse.update()
      mse.update_no_data()
    }
  })

  this.callback_manager = new CallbackManager()

  this.map = map
  this.selection = container
  this.background = background
}
function is_visible() {
  return this.selection.style('display') != 'none'
}
function toggle(on_off) {
  if (on_off===undefined) on_off = !this.is_visible()

  if (on_off) {
    // hold changes until accepting/abandoning
    this.hold_changes()
    // show the menu
    this.selection.style("display", "inline-block")
    this.background.style("display", "block")
    this.selection.select('input').node().focus()
    // escape key
    this.clear_escape = this.map.key_manager
      .add_escape_listener(function () {
        this.abandon_changes()
      }.bind(this), true)
    // enter key
    this.clear_enter = this.map.key_manager
      .add_enter_listener(function () {
        this.accept_changes()
      }.bind(this), true)
    // run the show callback
    this.callback_manager.run('show')
  } else {
    // draw on finish
    if (this.draw) this.map.draw_everything()
    // hide the menu
    this.selection.style("display", "none")
    this.background.style("display", "none")
    if (this.clear_escape) this.clear_escape()
    this.clear_escape = null
    if (this.clear_enter) this.clear_enter()
    this.clear_enter = null
    // run the hide callback
    this.callback_manager.run('hide')
  }
}
function hold_changes() {
  this.settings.hold_changes()
}
function abandon_changes() {
  this.draw = false
  this.settings.abandon_changes()
  this.toggle(false)
}
function accept_changes() {
  this.sel.selectAll('input').each(function (s) {
    this.blur()
  })
  this.draw = true
  this.settings.accept_changes()
  this.toggle(false)
}

function style_gui(sel, type, abs_callback) {
  /** A UI to edit style.

   */

  var t = sel.append('table').attr('class', 'settings-table'),
  settings = this.settings

  // styles
  t.append('tr').call(function (r) {
    r.append('td').text('Options:')
      .attr('class', 'options-label')
      .attr('title', ('Options for ' + type + ' data.'))
    var cell = r.append('td')

    var styles = [['Absolute value', 'abs',
                   ('If checked, use the absolute value when ' +
                    'calculating colors and sizes of ' + type + 's on the map')],
                  ['Size', 'size',
                   ('If checked, then size the ' +
                    (type == 'metabolite' ? 'radius of metabolite circles ' : 'thickness of reaction lines ') +
                    'according to the value of the ' + type + ' data')],
                  ['Color', 'color',
                   ('If checked, then color the ' +
                    (type == 'metabolite' ? 'metabolite circles ' : 'reaction lines ') +
                    'according to the value of the ' + type + ' data')],
                  ['Text (Show data in label)', 'text',
                   ('If checked, then show data values in the ' + type + ' ' +
                    'labels')]],
    style_cells = cell.selectAll('.option-group')
      .data(styles),
    s = style_cells.enter()
      .append('label')
      .attr('class', 'option-group')

    // make the checkbox
    var streams = [],
    get_styles = function () {
      var styles = []
      cell.selectAll('input')
        .each(function (d) { if (this.checked) styles.push(d[1]); })
      return styles
    }
    s.append('input').attr('type', 'checkbox')
      .on('change', function (d) {
        settings.set_conditional(type + '_styles', get_styles())
        if (d[1] == 'abs')
          abs_callback(this.checked)
      }).each(function (d) {
        // subscribe to changes in the model
        settings.streams[type + '_styles'].onValue(function (ar) {
          // check the box if the style is present
          this.checked = (ar.indexOf(d[1]) != -1)
        }.bind(this))
      })
    s.append('span')
      .text(function (d) { return d[0]; })
      .attr('title', function (d) { return d[2]; })
  })

  // compare_style
  t.append('tr').call(function (r) {
    r.append('td')
      .text('Comparison:')
      .attr('class', 'options-label')
      .attr('title', ('The function that will be used to compare ' +
                      'datasets, when paired data is loaded'))
    var cell = r.append('td')
      .attr('title', ('The function that will be used to compare ' +
                      'datasets, when paired data is loaded'));

    var styles = [['Fold Change', 'fold'],
                  ['Log2(Fold Change)', 'log2_fold'],
                  ['Difference', 'diff']],
    style_cells = cell.selectAll('.option-group')
      .data(styles),
    s = style_cells.enter()
      .append('label')
      .attr('class', 'option-group')

    // make the radio
    s.append('input').attr('type', 'radio')
      .attr('name', type + '_compare_style' + this.unique_string)
      .attr('value', function (d) { return d[1]; })
      .on('change', function () {
        if (this.checked)
          settings.set_conditional(type + '_compare_style', this.value)
      })
      .each(function () {
        // subscribe to changes in the model
        settings.streams[type + '_compare_style'].onValue(function (value) {
          // check the box for the new value
          this.checked = (this.value == value)
        }.bind(this))
      })
    s.append('span')
      .text(function (d) { return d[0]; })

  }.bind(this))

  // gene-specific settings
  if (type=='reaction') {
    var t = sel.append('table').attr('class', 'settings-table')
      .attr('title', ('The function that will be used to evaluate ' +
                      'AND connections in gene reaction rules (AND ' +
                      'connections generally connect components of ' +
                      'an enzyme complex)'))

    // and_method_in_gene_reaction_rule
    t.append('tr').call(function (r) {
      r.append('td')
        .text('Method for evaluating AND:')
        .attr('class', 'options-label-wide')
      var cell = r.append('td')

      var styles = [['Mean', 'mean'], ['Min', 'min']],
      style_cells = cell.selectAll('.option-group')
        .data(styles),
      s = style_cells.enter()
        .append('label')
        .attr('class', 'option-group')

      // make the radio
      var name = 'and_method_in_gene_reaction_rule'
      s.append('input').attr('type', 'radio')
        .attr('name', name + this.unique_string)
        .attr('value', function (d) { return d[1]; })
        .on('change', function () {
          if (this.checked)
            settings.set_conditional(name, this.value)
        })
        .each(function () {
          // subscribe to changes in the model
          settings.streams[name].onValue(function (value) {
            // check the box for the new value
            this.checked = (this.value == value)
          }.bind(this))
        })
      s.append('span')
        .text(function (d) { return d[0]; })
    }.bind(this))

  }
}

function view_gui(s, option_name, string, options) {

  // columns
  var settings = this.settings

  var t = s.append('table').attr('class', 'settings-table')
  t.append('tr').call(function (r) {
    // identifiers
    r.attr('title', ('The identifiers that are show in the reaction, ' +
                     'gene, and metabolite labels on the map.'))
    r.append('td').text('Identifiers:')
      .attr('class', 'options-label')
    var cell = r.append('td')

    var options = [['ID\'s', 'bigg_id'], ['Descriptive names', 'name']],
    style_cells = cell.selectAll('.option-group')
      .data(options),
    s = style_cells.enter()
      .append('label')
      .attr('class', 'option-group')

    // make the checkbox
    var name = 'identifiers_on_map'
    s.append('input').attr('type', 'radio')
      .attr('name', name + this.unique_string)
      .attr('value', function (d) { return d[1]; })
      .on('change', function () {
        if (this.checked)
          settings.set_conditional(name, this.value)
      })
      .each(function () {
        // subscribe to changes in the model
        settings.streams[name].onValue(function (value) {
          // check the box for the new value
          this.checked = (this.value == value)
        }.bind(this))
      })
    s.append('span').text(function (d) { return d[0]; })

  }.bind(this))

  var boolean_options = [
    ['scroll_behavior', 'Scroll to zoom (instead of scroll to pan)',
     ('If checked, then the scroll wheel and trackpad will control zoom ' +
      'rather than pan.'), {'zoom': true, 'pan': false}],
    ['hide_secondary_metabolites', 'Hide secondary metabolites',
     ('If checked, then only the primary metabolites ' +
      'will be displayed.')],
    ['show_gene_reaction_rules', 'Show gene reaction rules',
     ('If checked, then gene reaction rules will be displayed ' +
      'below each reaction label. (Gene reaction rules are always ' +
      'shown when gene data is loaded.)')],
    ['hide_all_labels', 'Hide reaction, gene, and metabolite labels',
     ('If checked, hide all reaction, gene, and metabolite labels')],
    ['allow_building_duplicate_reactions', 'Allow duplicate reactions',
     ('If checked, then allow duplicate reactions during model building.')],
    ['highlight_missing', 'Highlight reactions not in model',
     ('If checked, then highlight in red all the ' +
      'reactions on the map that are not present in ' +
      'the loaded model.')],
    ['enable_tooltips', 'Show tooltips',
     ('Show tooltips when hovering over reactions, metabolites, and genes')],
  ]

  var opts = s.append('div').attr('class', 'settings-container')
    .selectAll('.option-group')
    .data(boolean_options)
  // enter
  var e = opts.enter()
      .append('label')
      .attr('class', 'option-group full-line')
  e.append('input').attr('type', 'checkbox')
  e.append('span')
  // update
  opts.attr('title', function (d) { return d[2]; })
  opts.select('input')
    .on('change', function (d) {
      if (d.length >= 4) { // not a boolean setting
        for (var key in d[3]) {
          if (d[3][key] == this.checked) {
            settings.set_conditional(d[0], key)
            break
          }
        }
      } else { // boolean setting
        settings.set_conditional(d[0], this.checked)
      }
    })
    .each(function (d) {
      settings.streams[d[0]].onValue(function (value) {
        if (d.length >= 4) { // not a boolean setting
          this.checked = d[3][value]
        } else { // boolean setting
          this.checked = value
        }
      }.bind(this))
    })
  opts.select('span').text(function (d) { return d[1] })
  // exit
  opts.exit().remove()

  // message about text performance
  s.append('div')
    .style('margin-top', '16px')
    .classed('settings-tip', true)
    .text('Tip: To increase map performance, turn off text boxes (i.e. labels and gene reaction rules).')
}

},{"./CallbackManager":5,"./ScaleEditor":16,"./utils":33}],21:[function(require,module,exports){
/** TextEditInput */

var utils = require('./utils');
var PlacedDiv = require('./PlacedDiv');
var build = require('./build');


var TextEditInput = utils.make_class();
// instance methods
TextEditInput.prototype = {
    init: init,
    setup_map_callbacks: setup_map_callbacks,
    setup_zoom_callbacks: setup_zoom_callbacks,
    is_visible: is_visible,
    show: show,
    hide: hide,
    _accept_changes: _accept_changes,
    _add_and_edit: _add_and_edit
};
module.exports = TextEditInput;


// definitions
function init(selection, map, zoom_container) {
    var div = selection.append('div')
            .attr('id', 'text-edit-input');
    this.placed_div = PlacedDiv(div, map);
    this.placed_div.hide();
    this.input = div.append('input');

    this.map = map;
    this.setup_map_callbacks(map);
    this.zoom_container = zoom_container;
    this.setup_zoom_callbacks(zoom_container);
}

function setup_map_callbacks(map) {
    // input
    map.callback_manager.set('edit_text_label.text_edit_input', function(target, coords) {
        this.show(target, coords);
    }.bind(this));

    // new text_label
    map.callback_manager.set('new_text_label.text_edit_input', function(coords) {
        if (this.active_target !== null)
            this._accept_changes(this.active_target.target);
        this.hide();
        this._add_and_edit(coords);
    }.bind(this));

    map.callback_manager.set('hide_text_label_editor.text_edit_input', function() {
        this.hide();
    }.bind(this));
}

function setup_zoom_callbacks(zoom_container) {
    zoom_container.callback_manager.set('zoom.text_edit_input', function() {
        if (this.active_target)
            this._accept_changes(this.active_target.target);
        this.hide();
    }.bind(this));
    zoom_container.callback_manager.set('go_to.text_edit_input', function() {
        if (this.active_target)
            this._accept_changes(this.active_target.target);
        this.hide();
    }.bind(this));
}

function is_visible() {
    return this.placed_div.is_visible();
}

function show(target, coords) {
    // save any existing edit
    if (this.active_target) {
        this._accept_changes(this.active_target.target);
    }

    // set the current target
    this.active_target = { target: target,
                           coords: coords };

    // set the new value
    target.each(function(d) {
        this.input.node().value = d.text;
    }.bind(this));

    // place the input
    this.placed_div.place(coords);
    this.input.node().focus();

    // escape key
    this.clear_escape = this.map.key_manager
        .add_escape_listener(function() {
            this._accept_changes(target);
            this.hide();
        }.bind(this), true);
    // enter key
    this.clear_enter = this.map.key_manager
        .add_enter_listener(function(target) {
            this._accept_changes(target);
            this.hide();
        }.bind(this, target), true);
}

function hide() {
    // hide the input
    this.placed_div.hide();

    // clear the value
    this.input.attr('value', '');
    this.active_target = null;

    // clear escape
    if (this.clear_escape) this.clear_escape();
    this.clear_escape = null;
    // clear enter
    if (this.clear_enter) this.clear_enter();
    this.clear_enter = null;
    // turn off click listener
    // this.map.sel.on('click.', null);
}

function _accept_changes(target) {
    if (this.input.node().value == '') {
        // delete the label
        target.each(function(d) {
            var selected = {};
            selected[d.text_label_id] = this.map.text_labels[d.text_label_id];
            this.map.delete_selectable({}, selected, true);
        }.bind(this));
    } else {
        // set the text
        var text_label_ids = [];
        target.each(function(d) {
            this.map.edit_text_label(d.text_label_id, this.input.node().value, true);
            text_label_ids.push(d.text_label_id);
        }.bind(this));
    }
}

function _add_and_edit(coords) {
    // make an empty label
    var text_label_id = this.map.new_text_label(coords, '');
    // apply the cursor to the new label
    var sel = this.map.sel.select('#text-labels').selectAll('.text-label')
            .filter(function(d) { return d.text_label_id == text_label_id; });
    sel.select('text').classed('edit-text-cursor', true);
    this.show(sel, coords);
}

},{"./PlacedDiv":13,"./build":26,"./utils":33}],22:[function(require,module,exports){
/* global d3, window, XMLHttpRequest */

/**
 * Define a Tooltip component and interface with Tinier.
 */

var utils = require('./utils')
var tinier = require('tinier')
var createComponent = tinier.createComponent
var createInterface = tinier.createInterface
var typ = tinier.interfaceTypes
var h = tinier.createElement
var render = tinier.render
var _ = require('underscore')

// Define styles
var containerStyle = {
  'min-width': '270px',
  'min-height': '100px',
  'border-radius': '2px',
  'border': '1px solid #b58787',
  'padding': '7px',
  'background-color': '#fff',
  'text-align': 'left',
  'font-size': '16px',
  'font-family': 'sans-serif',
  'color': '#111',
  'box-shadow': '4px 6px 20px 0px rgba(0, 0, 0, 0.4)',
}

var idStyle = {
  'font-size': '18px',
  'font-weight': 'bold',
}

var buttonStyle = {
  'border-radius': '3px',
  'background-color': '#eee',
  'border': '1px solid #ddd',
  'margin-top': '4px',
}

var typeLabelStyle = {
  'position': 'absolute',
  'top': '4px',
  'right': '4px',
  'color': '#d27066',
  'background-color': '#ffeded',
  'border-radius': '2px',
  'font-size': '14px',
  'text-align': 'right',
  'padding': '0px 5px',
}

function decompartmentalizeCheck (id, type) {
  // ID without compartment, if metabolite.
  return type === 'metabolite' ? utils.decompartmentalize(id)[0] : id

}

function capitalizeFirstLetter (s) {
  return s === null ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

// Create the component
var DefaultTooltip = createComponent({
  displayName: 'DefaultTooltip',

  init: function () {
    return {
      biggId: '',
      name: '',
      loc: { x: 0, y: 0 },
      data: null,
      type: null,
    }
  },

  reducers: {
    setContainerData: function (args) {
      return Object.assign({}, args.state, {
        biggId: args.biggId,
        name: args.name,
        loc: args.loc,
        data: args.data,
        type: args.type,
      })
    },
  },

  methods: {
    openBigg: function (args) {
      var type = args.state.type
      var biggId = args.state.biggId
      var pref = 'http://bigg.ucsd.edu/'
      var url = (type === 'gene' ?
                 pref + 'search?query=' + biggId :
                 pref + 'universal/' + type + 's/' + decompartmentalizeCheck(biggId, type))
      window.open(url)
    },
  },

  render: function (args) {
    var decomp = decompartmentalizeCheck(args.state.biggId, args.state.type)
    var biggButtonText = 'Open ' + decomp + ' in BiGG Models.'

    return render(
      // parent node
      args.el,
      // the new tooltip element
      h('div',
        // tooltip style
        { style: containerStyle },
        // id
        h('span', { style: idStyle }, args.state.biggId),
        h('br'),
        // descriptive name
        'name: ' + args.state.name,
        h('br'),
        // data
        'data: ' + (args.state.data && args.state.data !== '(nd)' ?
                    args.state.data : 'no data'),
        h('br'),
        // BiGG Models button
        h('button',
          { style: buttonStyle, onClick: args.methods.openBigg, },
          biggButtonText),
        // type label
        h('div',
          { style: typeLabelStyle },
          capitalizeFirstLetter(args.state.type)))
    )
  },
})

module.exports = {
  DefaultTooltip: DefaultTooltip,
}

},{"./utils":33,"tinier":37,"underscore":38}],23:[function(require,module,exports){
var utils = require('./utils')
var PlacedDiv = require('./PlacedDiv')
var tinier = require('tinier')
var _ = require('underscore')

/**
 * Manage the tooltip that lives in a PlacedDiv.
 * @param selection
 * @param map
 * @param tooltip_component
 * @param zoom_container
 */
var TooltipContainer = utils.make_class()
// instance methods
TooltipContainer.prototype = {
  init: init,
  setup_map_callbacks: setup_map_callbacks,
  setup_zoom_callbacks: setup_zoom_callbacks,
  is_visible: is_visible,
  show: show,
  hide: hide,
  delay_hide: delay_hide,
  cancel_hide_tooltip: cancel_hide_tooltip,
}
module.exports = TooltipContainer

// definitions
function init (selection, map, tooltip_component, zoom_container) {
  var div = selection.append('div').attr('id', 'tooltip-container')
  this.placed_div = PlacedDiv(div, map)
  this.placed_div.hide()

  div.on('mouseover', this.cancel_hide_tooltip.bind(this))
  div.on('mouseleave', this.hide.bind(this))

  this.map = map
  this.setup_map_callbacks(map)
  this.zoom_container = zoom_container
  this.setup_zoom_callbacks(zoom_container)

  // keep a reference to tinier tooltip
  this.tooltip_component = tooltip_component
  // if they pass in a function, then use that
  this.tooltip_function = (_.isFunction(tooltip_component) ?
                           function (state) { tooltip_component({ state: state, el: div.node() })} :
                           null)
  // if they pass in a tinier component, use that
  this.tinier_tooltip = (tinier.checkType(tinier.COMPONENT, tooltip_component) ?
                         tinier.run(tooltip_component, div.node()) :
                         null)

  this.delay_hide_timeout = null
}

function setup_map_callbacks (map) {
  map.callback_manager.set('show_tooltip.tooltip_container', function (type, d) {
    if (map.settings.get_option('enable_tooltips')) {
      this.show(type, d)
    }
  }.bind(this))
  map.callback_manager.set('hide_tooltip.tooltip_container',
                           this.hide.bind(this))
  map.callback_manager.set('delay_hide_tooltip.tooltip_container',
                           this.delay_hide.bind(this))
}

function setup_zoom_callbacks (zoom_container) {
  zoom_container.callback_manager.set('zoom.tooltip_container', function () {
    if (this.is_visible()) {
      this.hide()
    }
  }.bind(this))
  zoom_container.callback_manager.set('go_to.tooltip_container', function () {
    if (this.is_visible()) {
      this.hide()
    }
  }.bind(this))
}

/**
 * Return visibility of tooltip container.
 * @return {Boolean} Whether tooltip is visible.
 */
function is_visible () {
  return this.placed_div.is_visible()
}

/**
 * Show and place the input.
 * @param {String} type - 'reaction_label', 'node_label', or 'gene_label'
 * @param {Object} d - D3 data for DOM element
 * @param {Object} coords - Object with x and y coords. Cannot use coords from
 *                          'd' because gene labels do not have them.
 */
function show (type, d) {
  // get rid of a lingering delayed hide
  this.cancel_hide_tooltip()

  if (_.contains([ 'reaction_label', 'node_label', 'gene_label' ], type)) {
    var coords = { x: d.label_x, y: d.label_y + 10 }
    this.placed_div.place(coords)
    const data = {
      biggId: d.bigg_id,
      name: d.name,
      loc: coords,
      data: d.data_string,
      type: type.replace('_label', '').replace('node', 'metabolite'),
    }
    if (this.tooltip_function !== null) {
      this.tooltip_function(data)
    } else if (this.tinier_tooltip) {
      this.tinier_tooltip.reducers.setContainerData(data)
    }
  } else {
    throw new Error('Tooltip not supported for object type ' + type)
  }
}

/**
 * Hide the input.
 */
function hide () {
  this.placed_div.hide()
}

/**
 * Hide the input after a short delay, so that mousing onto the tooltip does not
 * cause it to hide.
 */
function delay_hide () {
  this.delay_hide_timeout = setTimeout(function () {
    this.hide()
  }.bind(this), 100)
}

function cancel_hide_tooltip () {
  if (this.delay_hide_timeout !== null) {
    clearTimeout(this.delay_hide_timeout)
  }
}

},{"./PlacedDiv":13,"./utils":33,"tinier":37,"underscore":38}],24:[function(require,module,exports){
/** UndoStack. A constructor that can be used to store undo info. */

var utils = require('./utils');


var UndoStack = utils.make_class();
UndoStack.prototype = {
    init: init,
    push: push,
    undo: undo,
    redo: redo
};
module.exports = UndoStack;


// definitions
function init() {
    var stack_size = 40;
    this.stack = Array(stack_size);
    this.current = -1;
    this.oldest = -1;
    this.newest = -1;
    this.end_of_stack = true;
    this.top_of_stack = true;
}


function _incr(a, l) {
    return a + 1 > l - 1 ? 0 : a + 1;
}


function _decr(a, l) {
    return a - 1 < 0 ? l - 1 : a -  1;
}


function push(undo_fn, redo_fn) {
    this.current = _incr(this.current, this.stack.length);
    // change the oldest
    if (this.end_of_stack)
        this.oldest = this.current;
    else if (this.oldest == this.current)
        this.oldest = _incr(this.oldest, this.stack.length);
    this.stack[this.current] = { undo: undo_fn, redo: redo_fn };
    this.newest = this.current;

    // top of the stack
    this.top_of_stack = true;
    this.end_of_stack = false;
}


function undo() {
    // check that we haven't reached the end
    if (this.end_of_stack) return console.warn('End of stack.');
    // run the lastest stack function
    this.stack[this.current].undo();
    if (this.current == this.oldest) {
        // if the next index is less than the oldest, then the stack is dead
        this.end_of_stack = true;
    } else {
        // reference the next fn
        this.current = _decr(this.current, this.stack.length);
    }

    // not at the top of the stack
    this.top_of_stack = false;
}


function redo() {
    // check that we haven't reached the end
    if (this.top_of_stack) return console.warn('Top of stack.');

    if (!this.end_of_stack)
        this.current = _incr(this.current, this.stack.length);
    this.stack[this.current].redo();

    // if at top of stack
    if (this.current == this.newest)
        this.top_of_stack = true;

    // not at the end of the stack
    this.end_of_stack = false;
}

},{"./utils":33}],25:[function(require,module,exports){
/**
 * ZoomContainer
 */

/* global d3 */

var utils = require('./utils')
var CallbackManager = require('./CallbackManager')

var _ = require('underscore')

var ZoomContainer = utils.make_class()
ZoomContainer.prototype = {
  init: init,
  set_scroll_behavior: set_scroll_behavior,
  set_use_3d_transform: set_use_3d_transform,
  _update_scroll: _update_scroll,
  toggle_pan_drag: toggle_pan_drag,
  go_to: go_to,
  _go_to_3d: _go_to_3d,
  _clear_3d: _clear_3d,
  _go_to_svg: _go_to_svg,
  zoom_by: zoom_by,
  zoom_in: zoom_in,
  zoom_out: zoom_out,
  get_size: get_size,
  translate_off_screen: translate_off_screen,
}
module.exports = ZoomContainer

/**
 * Make a container that will manage panning and zooming. Creates a new SVG
 * element, with a parent div for CSS3 3D transforms.
 *
 * @param {D3 Selection} selection - A d3 selection of a HTML node to put the
 * zoom container in. Should have a defined width and height.
 *
 * @param {String} scroll_behavior - Either 'zoom' or 'pan'.
 *
 * @param {Boolean} use_3d_transform - If true, then use CSS3 3D transform to
 * speed up pan and zoom.
 *
 * @param {Boolean} fill_screen - If true, then apply styles to body and
 * selection that fill the screen. The styled classes are 'fill-screen-body' and
 * 'fill-screen-div'.
 */
function init (selection, scroll_behavior, use_3d_transform, fill_screen) {
  // set the selection class
  selection.classed('escher-container', true)

  // fill screen classes
  if (fill_screen) {
    d3.select('html').classed('fill-screen', true)
    d3.select('body').classed('fill-screen', true)
    selection.classed('fill-screen-div', true)
  }

  // make the svg
  var zoom_container = selection.append('div')
        .attr('class', 'escher-zoom-container')

  var css3_transform_container = zoom_container.append('div')
        .attr('class', 'escher-3d-transform-container')

  var svg = css3_transform_container.append('svg')
        .attr('class', 'escher-svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')

  // set up the zoom container
  svg.select('.zoom-g').remove()
  var zoomed_sel = svg.append('g').attr('class', 'zoom-g')

  // attributes
  this.selection = selection
  this.zoom_container = zoom_container
  this.css3_transform_container = css3_transform_container
  this.svg = svg
  this.zoomed_sel = zoomed_sel
  this.window_translate = { x: 0, y: 0 }
  this.window_scale = 1.0

  this._scroll_behavior = scroll_behavior
  this._use_3d_transform = use_3d_transform
  this._pan_drag_on = true
  this._zoom_behavior = null
  this._zoom_timeout = null
  this._svg_scale = this.window_scale
  this._svg_translate = this.window_translate
  // this._last_svg_ms = null

  // set up the callbacks
  this.callback_manager = new CallbackManager()

  // update the scroll behavior
  this._update_scroll()
}

/**
 * Set up pan or zoom on scroll.
 * @param {String} scroll_behavior - 'none', 'pan' or 'zoom'.
 */
function set_scroll_behavior (scroll_behavior) {
  this._scroll_behavior = scroll_behavior
  this._update_scroll()
}

/**
 * Set the option use_3d_transform
 */
function set_use_3d_transform (use_3d_transform) {
  this._use_3d_transform = use_3d_transform
}

/**
 * Toggle the zoom drag and the cursor UI for it.
 */
function toggle_pan_drag (on_off) {
  if (_.isUndefined(on_off)) {
    this._pan_drag_on = !this._pan_drag_on
  } else {
    this._pan_drag_on = on_off
  }

  if (this._pan_drag_on) {
    // turn on the hand
    this.zoomed_sel
      .classed('cursor-grab', true).classed('cursor-grabbing', false)
    this.zoomed_sel
      .on('mousedown.cursor', function (sel) {
        sel.classed('cursor-grab', false).classed('cursor-grabbing', true)
      }.bind(null, this.zoomed_sel))
      .on('mouseup.cursor', function (sel) {
        sel.classed('cursor-grab', true).classed('cursor-grabbing', false)
      }.bind(null, this.zoomed_sel))
  } else {
    // turn off the hand
    this.zoomed_sel.style('cursor', null)
      .classed('cursor-grab', false)
      .classed('cursor-grabbing', false)
    this.zoomed_sel.on('mousedown.cursor', null)
    this.zoomed_sel.on('mouseup.cursor', null)
  }

  // update the behaviors
  this._update_scroll()
}

/**
 * Update the pan and zoom behaviors. The behaviors are applied to the
 * css3_transform_container node.
 */
function _update_scroll () {
  if (!_.contains(['zoom', 'pan', 'none'], this._scroll_behavior)) {
    throw Error('Bad value for scroll_behavior: ' + this._scroll_behavior)
  }

  // clear all behaviors
  this.zoom_container.on('mousewheel.zoom', null) // zoom scroll behaviors
    .on('DOMMouseScroll.zoom', null) // disables older versions of Firefox
    .on('wheel.zoom', null) // disables newer versions of Firefox
    .on('dblclick.zoom', null)
    .on('mousewheel.escher', null) // pan scroll behaviors
    .on('DOMMouseScroll.escher', null)
    .on('wheel.escher', null)
    .on('mousedown.zoom', null) // drag behaviors
    .on('touchstart.zoom', null)
    .on('touchmove.zoom', null)
    .on('touchend.zoom', null)

  // This handles dragging to pan, and touch events (in any scroll mode). It
  // also handles scrolling to zoom (only 'zoom' mode). It also raises an
  // exception in node, so catch that during testing. This may be a bug with
  // d3 related to d3 using the global this.document. TODO look into this.
  try {
    this._zoom_behavior = d3.behavior.zoom()
      .on('zoomstart', function () {
        // prevent default zoom behavior, specifically for mobile pinch
        // zoom
        d3.event.sourceEvent.stopPropagation()
        d3.event.sourceEvent.preventDefault()
      }.bind(this))
      .on('zoom', function () {
        this.go_to(d3.event.scale, {x: d3.event.translate[0], y: d3.event.translate[1]})
      }.bind(this))
  } catch (err) {
    console.log('Not in a browser, so d3.behavior.zoom does not work.')
    this._zoom_behavior = null
    return
  }

  // set current location
  this._zoom_behavior.scale(this.window_scale)
  this._zoom_behavior.translate([ this.window_translate.x,
                                  this.window_translate.y ])

  // set it up
  this.zoom_container.call(this._zoom_behavior)

  // always turn off double-clicking to zoom
  this.zoom_container.on('dblclick.zoom', null)

  // if panning is off, then turn off these listeners
  if (!this._pan_drag_on) {
    this.zoom_container.on('mousedown.zoom', null)
      .on('touchstart.zoom', null)
      .on('touchmove.zoom', null)
      .on('touchend.zoom', null)
  }

  // if scroll to zoom is off, then turn off these listeners
  if (this._scroll_behavior !== 'zoom') {
    this.zoom_container
      .on('mousewheel.zoom', null) // zoom scroll behaviors
      .on('DOMMouseScroll.zoom', null) // disables older versions of Firefox
      .on('wheel.zoom', null); // disables newer versions of Firefox
  }

  // add listeners for scrolling to pan
  if (this._scroll_behavior === 'pan') {
    // Add the wheel listener
    var wheel_fn = function () {
      var ev = d3.event
      var sensitivity = 0.5
      // stop scroll in parent elements
      ev.stopPropagation()
      ev.preventDefault()
      ev.returnValue = false
      // change the location
      var get_directional_disp = function (wheel_delta, delta) {
        var the_delt = _.isUndefined(wheel_delta) ? delta : -wheel_delta / 1.5
        return the_delt * sensitivity
      }
      var new_translate = {
        x: this.window_translate.x - get_directional_disp(ev.wheelDeltaX, ev.deltaX),
        y: this.window_translate.y - get_directional_disp(ev.wheelDeltaY, ev.deltaY),
      }
      this.go_to(this.window_scale, new_translate)
    }.bind(this)

    // apply it
    this.zoom_container.on('mousewheel.escher', wheel_fn)
    this.zoom_container.on('DOMMouseScroll.escher', wheel_fn)
    this.zoom_container.on('wheel.escher', wheel_fn)
  }
}

// functions to scale and translate

/**
 * Zoom the container to a specified location.
 *
 * @param {Number} scale - The scale, between 0 and 1.
 *
 * @param {Object} translate - The location, of the form {x: 2.0, y: 3.0}.
 */
function go_to (scale, translate) {
  utils.check_undefined(arguments, ['scale', 'translate'])

  var use_3d_transform = this._use_3d_transform

  // check inputs
  if (!scale) throw new Error('Bad scale value')
  if (!translate || !('x' in translate) || !('y' in translate) ||
      isNaN(translate.x) || isNaN(translate.y))
    return console.error('Bad translate value')

  // save inputs
  this.window_scale = scale
  this.window_translate = translate

  // save to zoom behavior
  if (!_.isNull(this._zoom_behavior)) {
    this._zoom_behavior.scale(scale)
    var translate_array = [translate.x, translate.y]
    this._zoom_behavior.translate(translate_array)
  }

  if (use_3d_transform) { // 3d tranform
    // cancel all timeouts
    if (!_.isNull(this._zoom_timeout))
      clearTimeout(this._zoom_timeout)

    // set the 3d transform
    this._go_to_3d(scale, translate, this._svg_scale, this._svg_translate)

    // if another go_to does not happen within the delay time, then
    // redraw the svg
    this._zoom_timeout = _.delay(function () {
      // redraw the svg
      this._go_to_svg(scale, translate)
    }.bind(this), 100); // between 100 and 600 seems to be usable

  } else { // no 3d transform
    this._go_to_svg(scale, translate)
  }

  this.callback_manager.run('go_to')
}

/** Zoom & pan the CSS 3D transform container */
function _go_to_3d (scale, translate, svg_scale, svg_translate) {
  var n_scale = scale / svg_scale
  var n_translate = utils.c_minus_c(translate,
                                    utils.c_times_scalar(svg_translate, n_scale))
  var tranform = ('translate(' + n_translate.x + 'px,' + n_translate.y + 'px) ' +
                  'scale(' + n_scale + ')')
  this.css3_transform_container.style('transform', tranform)
  this.css3_transform_container.style('-webkit-transform', tranform)
  this.css3_transform_container.style('transform-origin', '0 0')
  this.css3_transform_container.style('-webkit-transform-origin', '0 0')
}

function _clear_3d () {
  this.css3_transform_container.style('transform', null)
  this.css3_transform_container.style('-webkit-transform', null)
  this.css3_transform_container.style('transform-origin', null)
  this.css3_transform_container.style('-webkit-transform-origin', null)
}

/**
 * Zoom & pan the svg element. Also runs the svg_start and svg_finish callbacks.
 * @param {Number} scale - The scale, between 0 and 1.
 * @param {Object} translate - The location, of the form {x: 2.0, y: 3.0}.
 * @param {Function} callback - (optional) A callback to run after scaling.
 */
function _go_to_svg (scale, translate, callback) {
  this.callback_manager.run('svg_start')

  // defer to update callbacks
  _.defer(function () {

    // start time
    // var start = new Date().getTime()

    // reset the 3d transform
    this._clear_3d()

    // redraw the svg
    this.zoomed_sel
      .attr('transform',
            'translate(' + translate.x + ',' + translate.y + ') ' +
            'scale(' + scale + ')')
    // save svg location
    this._svg_scale = this.window_scale
    this._svg_translate = this.window_translate

    _.defer(function () {
      // defer for callback after draw
      this.callback_manager.run('svg_finish')

      if (!_.isUndefined(callback)) callback()

      // wait a few ms to get a reliable end time
      // _.delay(function () {
      //     // end time
      //     var t = new Date().getTime() - start
      //     this._last_svg_ms = t
      // }.bind(this), 20)
    }.bind(this))
  }.bind(this))
}

/**
 * Zoom by a specified multiplier.
 *
 * @param {Number} amount - A multiplier for the zoom. Greater than 1 zooms in
 * and less than 1 zooms out.
 */
function zoom_by (amount) {
  var size = this.get_size()
  var shift = {
    x: size.width/2 - ((size.width/2 - this.window_translate.x) * amount +
                       this.window_translate.x),
    y: size.height/2 - ((size.height/2 - this.window_translate.y) * amount +
                        this.window_translate.y),
  }
  this.go_to(this.window_scale * amount,
             utils.c_plus_c(this.window_translate, shift))
}

/** Zoom in by the default amount with the default options. */
function zoom_in () {
  this.zoom_by(1.5)
}

/** Zoom out by the default amount with the default options. */
function zoom_out () {
  this.zoom_by(0.667)
}

/**
 * Return the size of the zoom container as coordinates, e.g. {x: 2, y: 3}
 */
function get_size () {
  return {
    width: parseInt(this.selection.style('width'), 10),
    height: parseInt(this.selection.style('height'), 10),
  }
}

/**
 * Shift window if new reacion will draw off the screen
 */
function translate_off_screen (coords) {
  // TODO BUG not accounting for scale correctly

  var margin = 120 // pixels
  var size = this.get_size()
  var current = {
    x: {
      min: - this.window_translate.x / this.window_scale +
        margin / this.window_scale,
      max: - this.window_translate.x / this.window_scale +
        (size.width-margin) / this.window_scale,
    },
    y: {
      min: - this.window_translate.y / this.window_scale +
        margin / this.window_scale,
      max: - this.window_translate.y / this.window_scale +
        (size.height-margin) / this.window_scale,
    },
  }

  if (coords.x < current.x.min) {
    this.window_translate.x = this.window_translate.x -
      (coords.x - current.x.min) * this.window_scale
    this.go_to(this.window_scale, this.window_translate)
  } else if (coords.x > current.x.max) {
    this.window_translate.x = this.window_translate.x -
      (coords.x - current.x.max) * this.window_scale
    this.go_to(this.window_scale, this.window_translate)
  }
  if (coords.y < current.y.min) {
    this.window_translate.y = this.window_translate.y -
      (coords.y - current.y.min) * this.window_scale
    this.go_to(this.window_scale, this.window_translate)
  } else if (coords.y > current.y.max) {
    this.window_translate.y = this.window_translate.y -
      (coords.y - current.y.max) * this.window_scale
    this.go_to(this.window_scale, this.window_translate)
  }
}

},{"./CallbackManager":5,"./utils":33,"underscore":38}],26:[function(require,module,exports){
/** build */

var utils = require('./utils');


module.exports = {
    new_reaction: new_reaction,
    rotate_nodes: rotate_nodes,
    move_node_and_dependents: move_node_and_dependents,
    new_text_label: new_text_label,
    bezier_id_for_segment_id: bezier_id_for_segment_id,
    bezier_ids_for_reaction_ids: bezier_ids_for_reaction_ids,
    new_beziers_for_segments: new_beziers_for_segments,
    new_beziers_for_reactions: new_beziers_for_reactions
};


// definitions
function new_reaction(bigg_id, cobra_reaction, cobra_metabolites,
                      selected_node_id, selected_node,
                      largest_ids, cofactors, angle) {
    /** New reaction.

     angle: clockwise from 'right', in degrees

     */

    // rotate the new reaction around the selected metabolite
    // convert to radians
    angle = Math.PI / 180 * angle;

    // generate a new integer id
    var new_reaction_id = String(++largest_ids.reactions);

    // calculate coordinates of reaction
    var selected_node_coords = { x: selected_node.x,
                                 y: selected_node.y };

    // rotate main axis around angle with distance
    var reaction_length = 300,
        main_axis = [ selected_node_coords,
                      utils.c_plus_c(selected_node_coords,
                                     {'x': reaction_length, 'y': 0}) ],
        center = { 'x': (main_axis[0].x + main_axis[1].x)/2,
                   'y': (main_axis[0].y + main_axis[1].y)/2 };

    // relative label location
    var label_d;
    if (Math.abs(angle) < Math.PI/4 ||
        Math.abs(angle - Math.PI) < Math.PI/4 ) {
            label_d = { x: -50, y: -40 };
        } else {
            label_d = { x: 30, y: 10 };
        }

    // relative anchor node distance
    var anchor_distance = 20;

    // new reaction structure
    var new_reaction = utils.clone(cobra_reaction);
    utils.extend(new_reaction,
                 { label_x: center.x + label_d.x,
                   label_y: center.y + label_d.y,
                   segments: {} });

    // set primary metabolites and count reactants/products

    // look for the selected metabolite, and record the indices
    var reactant_ranks = [], product_ranks = [],
        reactant_count = 0, product_count = 0,
        reaction_is_reversed = false;
    for (var met_bigg_id in new_reaction.metabolites) {
        // make the metabolites into objects
        var metabolite = cobra_metabolites[met_bigg_id],
            coefficient = new_reaction.metabolites[met_bigg_id],
            formula = metabolite.formula,
            new_metabolite = { coefficient: coefficient,
                               bigg_id: met_bigg_id,
                               name: metabolite.name };
        if (coefficient < 0) {
            new_metabolite.index = reactant_count;
            // score the metabolites. Infinity == selected, >= 1 == carbon containing
            var carbons = /C([0-9]+)/.exec(formula);
            if (selected_node.bigg_id==new_metabolite.bigg_id) {
                reactant_ranks.push([new_metabolite.index, Infinity]);
            } else if (carbons && cofactors.indexOf(utils.decompartmentalize(new_metabolite.bigg_id)[0])==-1) {
                reactant_ranks.push([new_metabolite.index, parseInt(carbons[1])]);
            }
            reactant_count++;
        } else {
            new_metabolite.index = product_count;
            var carbons = /C([0-9]+)/.exec(formula);
            if (selected_node.bigg_id==new_metabolite.bigg_id) {
                product_ranks.push([new_metabolite.index, Infinity]);
                reaction_is_reversed = true;
            } else if (carbons && cofactors.indexOf(utils.decompartmentalize(new_metabolite.bigg_id)[0])==-1) {
                product_ranks.push([new_metabolite.index, parseInt(carbons[1])]);
            }
            product_count++;
        }
        new_reaction.metabolites[met_bigg_id] = new_metabolite;
    }

    // get the rank with the highest score
    var max_rank = function(old, current) { return current[1] > old[1] ? current : old; },
        primary_reactant_index = reactant_ranks.reduce(max_rank, [0,0])[0],
        primary_product_index = product_ranks.reduce(max_rank, [0,0])[0];

    // set primary metabolites, and keep track of the total counts
    for (var met_bigg_id in new_reaction.metabolites) {
        var metabolite = new_reaction.metabolites[met_bigg_id];
        if (metabolite.coefficient < 0) {
            if (metabolite.index==primary_reactant_index) metabolite.is_primary = true;
            metabolite.count = reactant_count + 1;
        } else {
            if (metabolite.index==primary_product_index) metabolite.is_primary = true;
            metabolite.count = product_count + 1;
        }
    }

    // generate anchor nodes
    var new_anchors = {},
        anchors = [ { node_type: 'anchor_reactants',
                      dis: { x: anchor_distance * (reaction_is_reversed ? 1 : -1), y: 0 } },
                    { node_type: 'center',
                      dis: { x: 0, y: 0 } },
                    { node_type: 'anchor_products',
                      dis: { x: anchor_distance * (reaction_is_reversed ? -1 : 1), y: 0 } } ],
        anchor_ids = {};
    anchors.map(function(n) {
        var new_id = String(++largest_ids.nodes),
            general_node_type = (n.node_type=='center' ? 'midmarker' : 'multimarker');
        new_anchors[new_id] = { node_type: general_node_type,
                                x: center.x + n.dis.x,
                                y: center.y + n.dis.y,
                                connected_segments: [],
                                name: null,
                                bigg_id: null,
                                label_x: null,
                                label_y: null,
                                node_is_primary: null };
        anchor_ids[n.node_type] = new_id;
    });

    // add the segments, outside to inside
    var new_anchor_groups = [ [ anchor_ids['anchor_reactants'], anchor_ids['center'] ],
                              [ anchor_ids['anchor_products'],  anchor_ids['center'] ] ];
    new_anchor_groups.map(function(l) {
        var from_id = l[0], to_id = l[1],
            new_segment_id = String(++largest_ids.segments);
        new_reaction.segments[new_segment_id] =  { b1: null,
                                                   b2: null,
                                                   from_node_id: from_id,
                                                   to_node_id: to_id,
                                                   from_node_coefficient: null,
                                                   to_node_coefficient: null,
                                                   reversibility: new_reaction.reversibility,
                                                   data: new_reaction.data,
                                                   reverse_flux: new_reaction.reverse_flux };
        new_anchors[from_id].connected_segments.push({ segment_id: new_segment_id,
                                                       reaction_id: new_reaction_id });
        new_anchors[to_id].connected_segments.push({ segment_id: new_segment_id,
                                                     reaction_id: new_reaction_id });
    });

    // Add the metabolites, keeping track of total reactants and products.
    var new_nodes = new_anchors;
    for (var met_bigg_id in new_reaction.metabolites) {
        var metabolite = new_reaction.metabolites[met_bigg_id],
            primary_index, from_node_id;
        if (metabolite.coefficient < 0) {
            // metabolite.count = reactant_count + 1;
            primary_index = primary_reactant_index;
            from_node_id = anchor_ids['anchor_reactants'];
        } else {
            // metabolite.count = product_count + 1;
            primary_index = primary_product_index;
            from_node_id = anchor_ids['anchor_products'];
        }

        // calculate coordinates of metabolite components
        var met_loc = calculate_new_metabolite_coordinates(metabolite,
                                                           primary_index,
                                                           main_axis,
                                                           center,
                                                           reaction_length,
                                                           reaction_is_reversed);

        // if this is the existing metabolite
        if (selected_node.bigg_id==metabolite.bigg_id) {
            var new_segment_id = String(++largest_ids.segments);
            new_reaction.segments[new_segment_id] = { b1: met_loc.b1,
                                                      b2: met_loc.b2,
                                                      from_node_id: from_node_id,
                                                      to_node_id: selected_node_id,
                                                      from_node_coefficient: null,
                                                      to_node_coefficient: metabolite.coefficient,
                                                      reversibility: new_reaction.reversibility,
                                                      data: new_reaction.data,
                                                      reverse_flux: new_reaction.reverse_flux };
            // update the existing node
            selected_node.connected_segments.push({ segment_id: new_segment_id,
                                                    reaction_id: new_reaction_id });
            new_nodes[from_node_id].connected_segments.push({ segment_id: new_segment_id,
                                                              reaction_id: new_reaction_id });
        } else {
            // save new metabolite
            var new_segment_id = String(++largest_ids.segments),
                new_node_id = String(++largest_ids.nodes);
            new_reaction.segments[new_segment_id] = { b1: met_loc.b1,
                                                      b2: met_loc.b2,
                                                      from_node_id: from_node_id,
                                                      to_node_id: new_node_id,
                                                      from_node_coefficient: null,
                                                      to_node_coefficient: metabolite.coefficient,
                                                      reversibility: new_reaction.reversibility,
                                                      data: new_reaction.data,
                                                      reverse_flux: new_reaction.reverse_flux };
            // save new node
            new_nodes[new_node_id] = { connected_segments: [{ segment_id: new_segment_id,
                                                              reaction_id: new_reaction_id }],
                                       x: met_loc.circle.x,
                                       y: met_loc.circle.y,
                                       node_is_primary: Boolean(metabolite.is_primary),
                                       label_x: met_loc.circle.x + label_d.x,
                                       label_y: met_loc.circle.y + label_d.y,
                                       name: metabolite.name,
                                       bigg_id: metabolite.bigg_id,
                                       node_type: 'metabolite' };
            new_nodes[from_node_id].connected_segments.push({ segment_id: new_segment_id,
                                                              reaction_id: new_reaction_id });
        }
    }

    // now take out the extra reaction details
    var metabolites_array = []
    for (var bigg_id in new_reaction.metabolites) {
        metabolites_array.push({'bigg_id': bigg_id,
                                'coefficient': new_reaction.metabolites[bigg_id].coefficient});
    }
    new_reaction.metabolites = metabolites_array;

    // new_reactions object
    var new_reactions = {};
    new_reactions[new_reaction_id] = new_reaction;

    // new_beziers object
    var new_beziers = new_beziers_for_reactions(new_reactions);

    // add the selected node for rotation, and return it as a new (updated) node
    new_nodes[selected_node_id] = selected_node;
    rotate_nodes(new_nodes, new_reactions, new_beziers,
                 angle, selected_node_coords);

    return { new_reactions: new_reactions,
             new_beziers: new_beziers,
             new_nodes: new_nodes };
}

function rotate_nodes(selected_nodes, reactions, beziers, angle, center) {
    /** Rotate the nodes around center.

     selected_nodes: Nodes to rotate.
     reactions: Only updates beziers for these reactions.
     beziers: Also update the bezier points.
     angle: Angle to rotate in radians.
     center: Point to rotate around.

     */

    // functions
    var rotate_around = function(coord) {
        if (coord === null)
            return null;
        return utils.rotate_coords(coord, angle, center);
    };

    // recalculate: node
    var updated_node_ids = [], updated_reaction_ids = [];
    for (var node_id in selected_nodes) {
        var node = selected_nodes[node_id],
            // rotation distance
            displacement = rotate_around({ x: node.x, y: node.y }),
            // move the node
            updated = move_node_and_labels(node, reactions,
                                           displacement);
        // move the bezier points
        node.connected_segments.map(function(segment_obj) {
            var reaction = reactions[segment_obj.reaction_id];
            // If the reaction was not passed in the reactions argument, then ignore
            if (reaction === undefined) return;

            // rotate the beziers
            var segment_id = segment_obj.segment_id,
                segment = reaction.segments[segment_id];
            if (segment.to_node_id==node_id && segment.b2) {
                var displacement = rotate_around(segment.b2),
                    bez_id = bezier_id_for_segment_id(segment_id, 'b2');
                segment.b2 = utils.c_plus_c(segment.b2, displacement);
                beziers[bez_id].x = segment.b2.x;
                beziers[bez_id].y = segment.b2.y;
            } else if (segment.from_node_id==node_id && segment.b1) {
                var displacement = rotate_around(segment.b1),
                    bez_id = bezier_id_for_segment_id(segment_id, 'b1');
                segment.b1 = utils.c_plus_c(segment.b1, displacement);
                beziers[bez_id].x = segment.b1.x;
                beziers[bez_id].y = segment.b1.y;
            }
        });

        updated_reaction_ids = utils.unique_concat([updated_reaction_ids,
                                                    updated.reaction_ids]);
        updated_node_ids.push(node_id);
    }

    return { node_ids: updated_node_ids,
             reaction_ids: updated_reaction_ids };
}

function move_node_and_dependents(node, node_id, reactions, beziers, displacement) {
    /** Move the node and its labels and beziers.

     */
    var updated = move_node_and_labels(node, reactions, displacement);

    // move beziers
    node.connected_segments.map(function(segment_obj) {
        var reaction = reactions[segment_obj.reaction_id];
        // If the reaction was not passed in the reactions argument, then ignore
        if (reaction === undefined) return;

        // update beziers
        var segment_id = segment_obj.segment_id,
            segment = reaction.segments[segment_id];
        [['b1', 'from_node_id'], ['b2', 'to_node_id']].forEach(function(c) {
            var bez = c[0],
                node = c[1];
            if (segment[node]==node_id && segment[bez]) {
                segment[bez] = utils.c_plus_c(segment[bez], displacement);
                var tbez = beziers[bezier_id_for_segment_id(segment_id, bez)];
                tbez.x = segment[bez].x;
                tbez.y = segment[bez].y;
            }
        });

        // add to list of updated reaction ids if it isn't already there
        if (updated.reaction_ids.indexOf(segment_obj.reaction_id) < 0) {
            updated.reaction_ids.push(segment_obj.reaction_id);
        }
    });
    return updated;
}

function move_node_and_labels(node, reactions, displacement) {
    node.x = node.x + displacement.x;
    node.y = node.y + displacement.y;

    // recalculate: node label
    node.label_x = node.label_x + displacement.x;
    node.label_y = node.label_y + displacement.y;

    // recalculate: reaction label
    var updated_reaction_ids = [];
    node.connected_segments.map(function(segment_obj) {
        var reaction = reactions[segment_obj.reaction_id];
        // add to list of updated reaction ids if it isn't already there
        if (updated_reaction_ids.indexOf(segment_obj.reaction_id) < 0) {
            updated_reaction_ids.push(segment_obj.reaction_id);

            // update reaction label (but only once per reaction
            if (node.node_type == 'midmarker') {
                reaction.label_x = reaction.label_x + displacement.x;
                reaction.label_y = reaction.label_y + displacement.y;
            }
        }
    });
    return { reaction_ids: updated_reaction_ids };
}

function calculate_new_metabolite_coordinates(met, primary_index, main_axis, center, dis, is_reversed) {
    /** Calculate metabolite coordinates for a new reaction metabolite.

     */
    // new local coordinate system
    var displacement = main_axis[0],
        main_axis = [utils.c_minus_c(main_axis[0], displacement),
                     utils.c_minus_c(main_axis[1], displacement)],
        center = utils.c_minus_c(center, displacement);

    // Curve parameters
    var w = 80,  // distance between reactants and between products
        b1_strength = 0.4,
        b2_strength = 0.25,
        w2 = w*0.7,
        secondary_dis = 40,
        num_slots = Math.min(2, met.count - 1);

    // size and spacing for primary and secondary metabolites
    var ds, draw_at_index, r;
    if (met.is_primary) { // primary
        ds = 20;
    } else { // secondary
        ds = 10;
        // don't use center slot
        if (met.index > primary_index) draw_at_index = met.index - 1;
        else draw_at_index = met.index;
    }

    var de = dis - ds, // distance between ends of line axis
        reaction_axis = [{'x': ds, 'y': 0},
                         {'x': de, 'y': 0}];

    // Define line parameters and axis.
    // Begin with unrotated coordinate system. +y = Down, +x = Right.
    var end, circle, b1, b2;
    // reactants
    if (((met.coefficient < 0) != is_reversed) && met.is_primary) { // Ali == BADASS
        end = {'x': reaction_axis[0].x,
               'y': reaction_axis[0].y};
        b1 = {'x': center.x*(1-b1_strength) + reaction_axis[0].x*b1_strength,
              'y': center.y*(1-b1_strength) + reaction_axis[0].y*b1_strength};
        b2 = {'x': center.x*b2_strength + (end.x)*(1-b2_strength),
              'y': center.y*b2_strength + (end.y)*(1-b2_strength)},
        circle = {'x': main_axis[0].x,
                  'y': main_axis[0].y};
    } else if ((met.coefficient < 0) != is_reversed) {
        end = {'x': reaction_axis[0].x + secondary_dis,
               'y': reaction_axis[0].y + (w2*draw_at_index - w2*(num_slots-1)/2)},
        b1 = {'x': center.x*(1-b1_strength) + reaction_axis[0].x*b1_strength,
              'y': center.y*(1-b1_strength) + reaction_axis[0].y*b1_strength},
        b2 = {'x': center.x*b2_strength + end.x*(1-b2_strength),
              'y': center.y*b2_strength + end.y*(1-b2_strength)},
        circle = {'x': main_axis[0].x + secondary_dis,
                  'y': main_axis[0].y + (w*draw_at_index - w*(num_slots-1)/2)};
    } else if (((met.coefficient > 0) != is_reversed) && met.is_primary) {        // products
        end = {'x': reaction_axis[1].x,
               'y': reaction_axis[1].y};
        b1 = {'x': center.x*(1-b1_strength) + reaction_axis[1].x*b1_strength,
              'y': center.y*(1-b1_strength) + reaction_axis[1].y*b1_strength};
        b2 = {'x': center.x*b2_strength + end.x*(1-b2_strength),
              'y': center.y*b2_strength + end.y*(1-b2_strength)},
        circle = {'x': main_axis[1].x,
                  'y': main_axis[1].y};
    } else if ((met.coefficient > 0) != is_reversed) {
        end = {'x': reaction_axis[1].x - secondary_dis,
               'y': reaction_axis[1].y + (w2*draw_at_index - w2*(num_slots-1)/2)},
        b1 = {'x': center.x*(1-b1_strength) + reaction_axis[1].x*b1_strength,
              'y': center.y*(1-b1_strength) + reaction_axis[1].y*b1_strength};
        b2 = {'x': center.x*b2_strength + end.x*(1-b2_strength),
              'y': center.y*b2_strength + end.y*(1-b2_strength)},
        circle = {'x': main_axis[1].x - secondary_dis,
                  'y': main_axis[1].y + (w*draw_at_index - w*(num_slots-1)/2)};
    }
    var loc = {};
    loc.b1 = utils.c_plus_c(displacement, b1);
    loc.b2 = utils.c_plus_c(displacement, b2);
    loc.circle = utils.c_plus_c(displacement, circle);
    return loc;
}

function new_text_label(largest_ids, text, coords) {
    var new_id = String(++largest_ids.text_labels),
        new_label = { text: text,
                      x: coords.x,
                      y: coords.y };
    return {id: new_id, label: new_label};
}

function bezier_id_for_segment_id(segment_id, bez) {
    return segment_id+'_'+bez;
}

function bezier_ids_for_reaction_ids(reactions) {
    /** Return an array of beziers ids for the array of reaction ids.

     Arguments
     ---------

     reactions: A reactions object, e.g. a subset of *escher.Map.reactions*.

     */
    var bezier_ids = [];
    for (var reaction_id in reactions) {
        var reaction = reactions[reaction_id];

        for (var segment_id in reaction.segments) {
            var segment = reaction.segments[segment_id];

            ['b1', 'b2'].forEach(function(bez) {
                var seg_bez = segment[bez];
                if (seg_bez !== null) {
                    bezier_ids.push(bezier_id_for_segment_id(segment_id, bez));
                }
            });
        }
    }
    return bezier_ids;
}

function new_beziers_for_segments(segments, reaction_id) {
    /** Return an object containing beziers for the segments object.

     Arguments
     ---------

     segments: A segments object, e.g. *escher.Map.segments*.

     reaction_id: The reaction id for the segments.

     */
    var beziers = {};
    for (var segment_id in segments) {
        var segment = segments[segment_id];

        ['b1', 'b2'].forEach(function(bez) {
            var seg_bez = segment[bez];
            if (seg_bez !== null) {
                var bezier_id = bezier_id_for_segment_id(segment_id, bez);
                beziers[bezier_id] = {
                    bezier: bez,
                    x: seg_bez.x,
                    y: seg_bez.y,
                    reaction_id: reaction_id,
                    segment_id: segment_id
                };
            }
        });
    }
    return beziers;
}

function new_beziers_for_reactions(reactions) {
    /** Return an object containing beziers for the reactions object.

     Arguments
     ---------

     reactions: A reactions object, e.g. *escher.Map.reactions*.

     */
    var beziers = {};
    for (var reaction_id in reactions) {
        var reaction = reactions[reaction_id];

        var these = new_beziers_for_segments(reaction.segments, reaction_id);
        utils.extend(beziers, these);
    }
    return beziers;
}

},{"./utils":33}],27:[function(require,module,exports){
/**
 * @license
 *
 * complete.ly 1.0.0
 * MIT Licensing
 * Copyright (c) 2013 Lorenzo Puccetti
 *
 * This Software shall be used for doing good things, not bad things.
 *
 *
 * Modified by Zachary King (c) 2014.
 *
 **/

var utils = require('./utils');

module.exports = function(container, config) {
    document = utils.get_document(container);
    window = utils.get_window(container);

    config = config || {};
    config.fontSize =                       config.fontSize   || '13px';
    config.fontFamily =                     config.fontFamily || 'sans-serif';
    config.promptInnerHTML =                config.promptInnerHTML || '';
    config.color =                          config.color || '#333';
    config.hintColor =                      config.hintColor || '#aaa';
    config.backgroundColor =                config.backgroundColor || '#fff';
    config.dropDownBorderColor =            config.dropDownBorderColor || '#aaa';
    config.dropDownZIndex =                 config.dropDownZIndex || '100'; // to ensure we are in front of everybody
    config.dropDownOnHoverBackgroundColor = config.dropDownOnHoverBackgroundColor || '#ddd';

    var txtInput = document.createElement('input');
    txtInput.type ='text';
    txtInput.spellcheck = false;
    txtInput.style.fontSize =        config.fontSize;
    txtInput.style.fontFamily =      config.fontFamily;
    txtInput.style.color =           config.color;
    txtInput.style.backgroundColor = config.backgroundColor;
    txtInput.style.width = '100%';
    txtInput.style.outline = '0';
    txtInput.style.border =  '0';
    txtInput.style.margin =  '0';
    txtInput.style.padding = '0';

    var txtHint = txtInput.cloneNode();
    txtHint.disabled='';
    txtHint.style.position = 'absolute';
    txtHint.style.top =  '0';
    txtHint.style.left = '0';
    txtHint.style.borderColor = 'transparent';
    txtHint.style.boxShadow =   'none';
    txtHint.style.color = config.hintColor;

    txtInput.style.backgroundColor ='transparent';
    txtInput.style.verticalAlign = 'top';
    txtInput.style.position = 'relative';

    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.outline = '0';
    wrapper.style.border =  '0';
    wrapper.style.margin =  '0';
    wrapper.style.padding = '0';

    var prompt = document.createElement('div');
    prompt.style.position = 'absolute';
    prompt.style.outline = '0';
    prompt.style.margin =  '0';
    prompt.style.padding = '0';
    prompt.style.border =  '0';
    prompt.style.fontSize =   config.fontSize;
    prompt.style.fontFamily = config.fontFamily;
    prompt.style.color =           config.color;
    prompt.style.backgroundColor = config.backgroundColor;
    prompt.style.top = '0';
    prompt.style.left = '0';
    prompt.style.overflow = 'hidden';
    prompt.innerHTML = config.promptInnerHTML;
    prompt.style.background = 'transparent';
    if (document.body === undefined) {
        throw 'document.body is undefined. The library was wired up incorrectly.';
    }
    document.body.appendChild(prompt);
    var w = prompt.getBoundingClientRect().right; // works out the width of the prompt.
    wrapper.appendChild(prompt);
    prompt.style.visibility = 'visible';
    prompt.style.left = '-'+w+'px';
    wrapper.style.marginLeft= w+'px';

    wrapper.appendChild(txtHint);
    wrapper.appendChild(txtInput);

    var dropDown = document.createElement('div');
    dropDown.style.position = 'absolute';
    dropDown.style.visibility = 'hidden';
    dropDown.style.outline = '0';
    dropDown.style.margin =  '0';
    dropDown.style.padding = '0';
    dropDown.style.textAlign = 'left';
    dropDown.style.fontSize =   config.fontSize;
    dropDown.style.fontFamily = config.fontFamily;
    dropDown.style.backgroundColor = config.backgroundColor;
    dropDown.style.zIndex = config.dropDownZIndex;
    dropDown.style.cursor = 'default';
    dropDown.style.borderStyle = 'solid';
    dropDown.style.borderWidth = '1px';
    dropDown.style.borderColor = config.dropDownBorderColor;
    dropDown.style.overflowX= 'hidden';
    dropDown.style.whiteSpace = 'pre';
    dropDown.style.overflowY = 'scroll';

    var createDropDownController = function(elem) {
        var rows = [];
        var ix = 0;
        var oldIndex = -1;
        var current_row = null;

        var onMouseOver =  function() { this.style.outline = '1px solid #ddd'; }
        var onMouseOut =   function() { this.style.outline = '0'; }
        var onDblClick =  function(e) {
            e.preventDefault();
            p.onmouseselection(this.id);
        }

        var p = {
            hide :  function() { elem.style.visibility = 'hidden'; },
            refresh : function(token, options) {
                elem.style.visibility = 'hidden';
                ix = 0;
                elem.innerHTML ='';
                var vph = (window.innerHeight || document.documentElement.clientHeight);
                var rect = elem.parentNode.getBoundingClientRect();
                var distanceToTop = rect.top - 6;                        // heuristic give 6px
                var distanceToBottom = vph - rect.bottom -6;  // distance from the browser border.

                rows = [];
                for (var i = 0; i < options.length; i++) {
                    // ignore case
                    var found = options[i].matches.filter(function(match) {
                        return match.toLowerCase().indexOf(token.toLowerCase()) == 0;
                    });
                    if (found.length == 0)
                        continue;
                    var divRow = document.createElement('div');
                    divRow.style.color = config.color;
                    divRow.onmouseover = onMouseOver;
                    divRow.onmouseout =  onMouseOut;
                    // prevent selection for double click
                    divRow.onmousedown = function(e) { e.preventDefault(); };
                    divRow.ondblclick = onDblClick;
                    divRow.__hint = found[0];
                    divRow.id = options[i].id;
                    divRow.innerHTML = options[i].html;
                    rows.push(divRow);
                    elem.appendChild(divRow);
                    // limit results and add a note at the buttom
                    if (rows.length >= rs.display_limit) {
                        var divRow2 = document.createElement('div');
                        divRow2.innerHTML = ' ' + (options.length - rows.length) + ' more';
                        rows.push(divRow2);
                        elem.appendChild(divRow2);
                        break;
                    }
                }
                if (rows.length===0) {
                    return; // nothing to show.
                }
                p.highlight(0);

                // Heuristic (only when the distance to the to top is 4
                // times more than distance to the bottom
                if (distanceToTop > distanceToBottom*3) {
                    // we display the dropDown on the top of the input text
                    elem.style.maxHeight =  distanceToTop+'px';
                    elem.style.top ='';
                    elem.style.bottom ='100%';
                } else {
                    elem.style.top = '100%';
                    elem.style.bottom = '';
                    elem.style.maxHeight =  distanceToBottom+'px';
                }
                elem.style.visibility = 'visible';
            },
            highlight : function(index) {
                if (oldIndex !=-1 && rows[oldIndex]) {
                    rows[oldIndex].style.backgroundColor = config.backgroundColor;
                }
                rows[index].style.backgroundColor = config.dropDownOnHoverBackgroundColor; // <-- should be config
                oldIndex = index;
                current_row = rows[index];
            },
            // moves the selection either up or down (unless it's not
            // possible) step is either +1 or -1.
            move : function(step) {
                // nothing to move if there is no dropDown. (this happens if
                // the user hits escape and then down or up)
                if (elem.style.visibility === 'hidden')
                    return '';
                // No circular scrolling
                if (ix+step === -1 || ix+step === rows.length)
                    return rows[ix].__hint;
                ix+=step;
                p.highlight(ix);
                return rows[ix].__hint;
            },
            onmouseselection : function() {},
            get_current_row: function () {
                return current_row;
            }
        };
        return p;
    }

    var dropDownController = createDropDownController(dropDown);

    dropDownController.onmouseselection = function(id) {
        rs.onEnter(id)
        rs.input.focus();
    }

    wrapper.appendChild(dropDown);
    container.appendChild(wrapper);

    var spacer,
        // This will contain the leftSide part of the textfield (the bit that
        // was already autocompleted)
        leftSide;

    function calculateWidthForText(text) {
        if (spacer === undefined) { // on first call only.
            spacer = document.createElement('span');
            spacer.style.visibility = 'hidden';
            spacer.style.position = 'fixed';
            spacer.style.outline = '0';
            spacer.style.margin =  '0';
            spacer.style.padding = '0';
            spacer.style.border =  '0';
            spacer.style.left = '0';
            spacer.style.whiteSpace = 'pre';
            spacer.style.fontSize =   config.fontSize;
            spacer.style.fontFamily = config.fontFamily;
            spacer.style.fontWeight = 'normal';
            document.body.appendChild(spacer);
        }

        // Used to encode an HTML string into a plain text.
        // taken from http://stackoverflow.com/questions/1219860/javascript-jquery-html-encoding
        spacer.innerHTML = String(text).replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return spacer.getBoundingClientRect().right;
    }


    var rs = {
        get_hint :    function(x) { return x; },
        display_limit: 1000,
        onArrowDown : function() {},               // defaults to no action.
        onArrowUp :   function() {},               // defaults to no action.
        onEnter :     function() {},               // defaults to no action.
        onTab :       function() {},               // defaults to no action.
        onChange:     function() { rs.repaint() }, // defaults to repainting.
        startFrom:    0,
        options:      [],

        // Only to allow easy access to the HTML elements to the final user
        // (possibly for minor customizations)
        wrapper : wrapper,
        input :  txtInput,
        hint  :  txtHint,
        dropDown :  dropDown,

        prompt : prompt,
        setText : function(text) {
            txtHint.value = text;
            txtInput.value = text;
        },
        getText : function() {
            return txtInput.value;
        },
        hideDropDown : function() {
            dropDownController.hide();
        },
        repaint : function() {
            var text = txtInput.value;
            var startFrom =  rs.startFrom;
            var options =    rs.options;
            var optionsLength = options.length;

            // breaking text in leftSide and token.
            var token = text.substring(startFrom);
            leftSide =  text.substring(0,startFrom);

            // updating the hint.
            txtHint.value ='';
            for (var i = 0; i < optionsLength; i++) {
                var found = options[i].matches.filter(function(match) {
                    return match.toLowerCase().indexOf(token.toLowerCase()) == 0;
                });
                if (found.length == 0)
                    continue;
                txtHint.value = rs.get_hint(found[0]);
                break;
            }

            // moving the dropDown and refreshing it.
            dropDown.style.left = calculateWidthForText(leftSide)+'px';
            dropDownController.refresh(token, rs.options);
        }
    };

    var registerOnTextChangeOldValue;

    // Register a callback function to detect changes to the content of the
    // input-type-text.  Those changes are typically followed by user's
    // action: a key-stroke event but sometimes it might be a mouse click.
    var registerOnTextChange = function(txt, callback) {
        registerOnTextChangeOldValue = txt.value;
        var handler = function() {
            var value = txt.value;
            if (registerOnTextChangeOldValue !== value) {
                registerOnTextChangeOldValue = value;
                callback(value);
            }
        };

        // For user's actions, we listen to both input events and key up events
        // It appears that input events are not enough so we defensively listen to key up events too.
        // source: http://help.dottoro.com/ljhxklln.php
        //
        // The cost of listening to three sources should be negligible as the handler will invoke callback function
        // only if the text.value was effectively changed.
        txt.addEventListener("input",  handler, false);
        txt.addEventListener('keyup',  handler, false);
        txt.addEventListener('change', handler, false);
    };


    registerOnTextChange(txtInput,function(text) { // note the function needs to be wrapped as API-users will define their onChange
        rs.onChange(text);
        rs.repaint();
    });


    var keyDownHandler = function(e) {
        e = e || window.event;
        var keyCode = e.keyCode;

        if (keyCode == 33) { return; } // page up (do nothing)
        if (keyCode == 34) { return; } // page down (do nothing);

        // right,  end, tab  (autocomplete triggered)
        if (keyCode == 39 || keyCode == 35 || keyCode == 9) {
            // for tabs we need to ensure that we override the default
            // behaviour: move to the next focusable HTML-element
            if (keyCode == 9) {
                e.preventDefault();
                e.stopPropagation();
                if (txtHint.value.length == 0) {
                    // tab was called with no action.
                    rs.onTab();
                }
            }
            // if there is a hint
            if (txtHint.value.length > 0) {
                txtInput.value = txtHint.value;
                var hasTextChanged = registerOnTextChangeOldValue != txtInput.value
                // avoid dropDown to appear again
                registerOnTextChangeOldValue = txtInput.value;
                // for example imagine the array contains the following
                // words: bee, beef, beetroot. User has hit enter to get
                // 'bee' it would be prompted with the dropDown again (as
                // beef and beetroot also match)
                if (hasTextChanged) {
                    // force it.
                    rs.onChange(txtInput.value);
                }
            }
            return;
        }

        if (keyCode == 13) { // enter
            // get current
            var id = dropDownController.get_current_row().id;
            rs.onEnter(id);
            return;
        }

        if (keyCode == 40) { // down
            var m = dropDownController.move(+1);
            if (m == '') { rs.onArrowDown(); }
            txtHint.value = rs.get_hint(m);
            return;
        }

        if (keyCode == 38 ) { // up
            var m = dropDownController.move(-1);
            if (m == '') { rs.onArrowUp(); }
            txtHint.value = rs.get_hint(m);
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // it's important to reset the txtHint on key down. Think: user
        // presses a letter (e.g. 'x') and never releases. You get
        // (xxxxxxxxxxxxxxxxx) and you would see still the hint. Reset the
        // txtHint. (it might be updated onKeyUp).
        txtHint.value ='';
    };

    txtInput.addEventListener("keydown",  keyDownHandler, false);
    return rs;
};

},{"./utils":33}],28:[function(require,module,exports){
/** data_styles */

/* global d3 */

var utils = require('./utils');
var _ = require('underscore');

module.exports = {
    import_and_check: import_and_check,
    text_for_data: text_for_data,
    float_for_data: float_for_data,
    reverse_flux_for_data: reverse_flux_for_data,
    gene_string_for_data: gene_string_for_data,
    csv_converter: csv_converter,
    genes_for_gene_reaction_rule: genes_for_gene_reaction_rule,
    evaluate_gene_reaction_rule: evaluate_gene_reaction_rule,
    replace_gene_in_rule: replace_gene_in_rule,
    apply_reaction_data_to_reactions: apply_reaction_data_to_reactions,
    apply_metabolite_data_to_nodes: apply_metabolite_data_to_nodes,
    apply_gene_data_to_reactions: apply_gene_data_to_reactions
};


// globals
var RETURN_ARG = function(x) { return x; },
    ESCAPE_REG = /([.*+?^=!:${}()|\[\]\/\\])/g,
    EMPTY_LINES = /\n\s*\n/g,
    TRAILING_NEWLINE = /\n\s*(\)*)\s*$/,
    AND_OR = /([\(\) ])(?:and|or)([\)\( ])/ig,
    ALL_PARENS = /[\(\)]/g,
    // capture an expression surrounded by whitespace and a set of parentheses
    EXCESS_PARENS = /\(\s*(\S+)\s*\)/g,
    OR = /\s+or\s+/i,
    AND = /\s+and\s+/i,
    // find ORs
    OR_EXPRESSION = /(^|\()(\s*-?[0-9.]+\s+(?:or\s+-?[0-9.]+\s*)+)(\)|$)/ig,
    // find ANDS, respecting order of operations (and before or)
    AND_EXPRESSION = /(^|\(|or\s)(\s*-?[0-9.]+\s+(?:and\s+-?[0-9.]+\s*)+)(\sor|\)|$)/ig;


function import_and_check(data, name, all_reactions) {
    /** Convert imported data to a style that can be applied to reactions
     and nodes.

     Arguments
     ---------

     data: The data object.

     name: Either 'reaction_data', 'metabolite_data', or 'gene_data'

     all_reactions: Required for name == 'gene_data'. Must include all
     GPRs for the map and model.

     */

    // check arguments
    if (data===null)
        return null;
    if (['reaction_data', 'metabolite_data', 'gene_data'].indexOf(name) == -1)
        throw new Error('Invalid name argument: ' + name);

    // make array
    if (!(data instanceof Array)) {
        data = [data];
    }
    // check data
    var check = function() {
        if (data===null)
            return null;
        if (data.length==1)
            return null;
        if (data.length==2)
            return null;
        return console.warn('Bad data style: ' + name);
    };
    check();
    data = utils.array_to_object(data);

    if (name == 'gene_data') {
        if (all_reactions === undefined)
            throw new Error('Must pass all_reactions argument for gene_data');
        data = align_gene_data_to_reactions(data, all_reactions);
    }

    return data;

    // definitions
    function align_gene_data_to_reactions(data, reactions) {
        var aligned = {},
            null_val = [null];
        // make an array of nulls as the default
        for (var first_gene_id in data) {
            null_val = data[first_gene_id].map(function() { return null; });
            break;
        }
        for (var reaction_id in reactions) {
            var reaction = reactions[reaction_id],
                bigg_id = reaction.bigg_id,
                this_gene_data = {};

            reaction.genes.forEach(function(gene) {
                // check both gene id and gene name
                ['bigg_id', 'name'].forEach(function(kind) {
                    var d = data[gene[kind]] || utils.clone(null_val);
                    // merger with existing data if present
                    var existing_d = this_gene_data[gene.bigg_id];
                    if (typeof existing_d === 'undefined') {
                        this_gene_data[gene.bigg_id] = d;
                    } else {
                        for (var i = 0; i < d.length; i++) {
                            var pnt = d[i];
                            if (pnt !== null)
                                existing_d[i] = pnt;
                        }
                    }
                });
            });
            aligned[bigg_id] = this_gene_data;
        }
        return aligned;
    }
}

function float_for_data(d, styles, compare_style) {
    // all null
    if (d === null)
        return null;

    // absolute value
    var take_abs = (styles.indexOf('abs') != -1);

    if (d.length==1) { // 1 set
        // 1 null
        var f = _parse_float_or_null(d[0]);
        if (f === null)
            return null;
        return abs(f, take_abs);
    } else if (d.length==2) { // 2 sets
        // 2 null
        var fs = d.map(_parse_float_or_null);
        if (fs[0] === null || fs[1] === null)
            return null;

        if (compare_style == 'diff') {
            return diff(fs[0], fs[1], take_abs);
        } else if (compare_style == 'fold') {
            return check_finite(fold(fs[0], fs[1], take_abs));
        }
        else if (compare_style == 'log2_fold') {
            return check_finite(log2_fold(fs[0], fs[1], take_abs));
        }
    } else {
        throw new Error('Data array must be of length 1 or 2');
    }
    throw new Error('Bad data compare_style: ' + compare_style);

    // definitions
    function check_finite(x) {
        return isFinite(x) ? x : null;
    }
    function abs(x, take_abs) {
        return take_abs ? Math.abs(x) : x;
    }
    function diff(x, y, take_abs) {
        if (take_abs) return Math.abs(y - x);
        else return y - x;
    }
    function fold(x, y, take_abs) {
        if (x == 0 || y == 0) return null;
        var fold = (y >= x ? y / x : - x / y);
        return take_abs ? Math.abs(fold) : fold;
    }
    function log2_fold(x, y, take_abs) {
        if (x == 0) return null;
        if (y / x < 0) return null;
        var log = Math.log(y / x) / Math.log(2);
        return take_abs ? Math.abs(log) : log;
    }
}

function reverse_flux_for_data(d) {
    if (d === null || d[0] === null)
        return false;
    return (d[0] < 0);
}

/**
 * Add gene values to the gene_reaction_rule string.
 * @param {String} rule - The gene reaction rule.
 * @param {} gene_values - The values.
 * @param {} genes - An array of objects specifying the gene bigg_id and name.
 * @param {} styles - The reaction styles.
 * @param {String} identifiers_on_map - The type of identifiers ('bigg_id' or 'name').
 * @param {} compare_style - The comparison style.
 *
 * @return {Array} A list of objects with:
 *
 * {
 *    bigg_id: The bigg ID.
 *    name: The name.
 *    text: The new string with formatted data values.
 * }
 *
 * The text elements should each appear on a new line.
 */
function gene_string_for_data (rule, gene_values, genes, styles,
                               identifiers_on_map, compare_style) {
    var out_text = rule
    var no_data = (gene_values === null)
    // keep track of bigg_ids to remove repeats
    var genes_found = {}

    genes.forEach(function(g_obj) {
        var bigg_id = g_obj.bigg_id

        // ignore repeats that may have found their way into the genes object
        if (bigg_id in genes_found) return
        genes_found[bigg_id] = true

        // generate the string
        if (no_data) {
            out_text = replace_gene_in_rule(out_text, bigg_id, bigg_id + '\n')
        } else {
            if (!(bigg_id in gene_values))
                return
            var d = gene_values[bigg_id]
            var f = float_for_data(d, styles, compare_style)
            var format = (f === null ? RETURN_ARG : d3.format('.3g'))
            if (d.length === 1) {
                out_text = replace_gene_in_rule(out_text, bigg_id,
                                                bigg_id + ' (' + null_or_d(d[0], format) + ')\n')
            } else if (d.length === 2) {
                var new_str
                // check if they are all text
                var any_num = _.any(d, function (x) {
                    return _parse_float_or_null(x) !== null
                })
                if (any_num) {
                    new_str = (bigg_id + ' (' +
                               null_or_d(d[0], format) + ', ' +
                               null_or_d(d[1], format) + ': ' +
                               null_or_d(f, format) +
                               ')\n');
                } else {
                    new_str = (bigg_id + ' (' +
                               null_or_d(d[0], format) + ', ' +
                               null_or_d(d[1], format) + ')\n')
                }
                out_text = replace_gene_in_rule(out_text, bigg_id, new_str)
            }
        }
    })
    out_text = (out_text
                // remove empty lines
                .replace(EMPTY_LINES, '\n')
                // remove trailing newline (with or without parens)
                .replace(TRAILING_NEWLINE, '$1'))

    // split by newlines, and switch to names if necessary
    var result = out_text.split('\n').map(function (text) {
        for (var i = 0, l = genes.length; i < l; i++) {
            var gene = genes[i]
            if (text.indexOf(gene.bigg_id) !== -1) {
                // replace with names
                if (identifiers_on_map === 'name')
                    text = replace_gene_in_rule(text, gene.bigg_id, gene.name)
                return { bigg_id: gene.bigg_id, name: gene.name, text: text }
            }
        }
        // not found, then none
        return { bigg_id: null, name: null, text: text }
    })
    return result

    // definitions
    function null_or_d (d, format) {
        return d === null ? 'nd' : format(d)
    }
}

function text_for_data(d, f) {
    if (d === null)
        return null_or_d(null);
    if (d.length == 1) {
        var format = (f === null ? RETURN_ARG : d3.format('.3g'));
        return null_or_d(d[0], format);
    }
    if (d.length == 2) {
        var format = (f === null ? RETURN_ARG : d3.format('.3g')),
            t = null_or_d(d[0], format);
        t += ', ' + null_or_d(d[1], format);
        t += ': ' + null_or_d(f, format);
        return t;
    }
    return '';

    // definitions
    function null_or_d(d, format) {
        return d === null ? '(nd)' : format(d);
    }
}

function csv_converter(csv_rows) {
    /** Convert data from a csv file to json-style data.

     File must include a header row.

     */
    // count rows
    var c = csv_rows[0].length,
        converted = [];
    if (c < 2 || c > 3)
        throw new Error('CSV file must have 2 or 3 columns');
    // set up rows
    for (var i = 1; i < c; i++) {
        converted[i - 1] = {};
    }
    // fill
    csv_rows.slice(1).forEach(function(row) {
        for (var i = 1, l = row.length; i < l; i++) {
            converted[i - 1][row[0]] = row[i];
        }
    });
    return converted;
}

function genes_for_gene_reaction_rule(rule) {
    /** Find unique genes in gene_reaction_rule string.

     Arguments
     ---------

     rule: A boolean string containing gene names, parentheses, AND's and
     OR's.

     Returns
     -------

     An array of gene strings.

     */
    var genes = rule
    // remove ANDs and ORs, surrounded by space or parentheses
            .replace(AND_OR, '$1$2')
    // remove parentheses
            .replace(ALL_PARENS, '')
    // split on whitespace
            .split(' ')
            .filter(function(x) { return x != ''; });
    // unique strings
    return utils.unique_strings_array(genes);
}

function evaluate_gene_reaction_rule(rule, gene_values, and_method_in_gene_reaction_rule) {
    /** Return a value given the rule and gene_values object.

     Arguments
     ---------

     rule: A boolean string containing gene names, parentheses, AND's and
     OR's.

     gene_values: Object with gene_ids for keys and numbers for values.

     and_method_in_gene_reaction_rule: Either 'mean' or 'min'.

     */

    var null_val = [null],
        l = 1;
    // make an array of nulls as the default
    for (var gene_id in gene_values) {
        null_val = gene_values[gene_id].map(function() { return null; });
        l = null_val.length;
        break;
    }

    if (rule == '') return utils.clone(null_val);

    // for each element in the arrays
    var out = [];
    for (var i = 0; i < l; i++) {
        // get the rule
        var curr_val = rule;

        // put all the numbers into the expression
        var all_null = true;
        for (var gene_id in gene_values) {
            var f = _parse_float_or_null(gene_values[gene_id][i]);
            if (f === null) {
                f = 0;
            } else {
                all_null = false;
            }
            curr_val = replace_gene_in_rule(curr_val, gene_id, f);
        }
        if (all_null) {
            out.push(null);
            continue;
        }

        // recursively evaluate
        while (true) {
            // arithemtic expressions
            var new_curr_val = curr_val;

            // take out excessive parentheses
            new_curr_val = new_curr_val.replace(EXCESS_PARENS, ' $1 ');

            // or's
            new_curr_val = new_curr_val.replace(OR_EXPRESSION, function(match, p1, p2, p3) {
                // sum
                var nums = p2.split(OR).map(parseFloat),
                    sum = nums.reduce(function(a, b) { return a + b;});
                return p1 + sum + p3;
            });
            // and's
            new_curr_val = new_curr_val.replace(AND_EXPRESSION, function(match, p1, p2, p3) {
                // find min
                var nums = p2.split(AND).map(parseFloat),
                    val = (and_method_in_gene_reaction_rule == 'min' ?
                           Math.min.apply(null, nums) :
                           nums.reduce(function(a, b) { return a + b; }) / nums.length);
                return p1 + val + p3;
            });
            // break if there is no change
            if (new_curr_val == curr_val)
                break;
            curr_val = new_curr_val;
        }
        // strict test for number
        var num = Number(curr_val);
        if (isNaN(num)) {
            console.warn('Could not evaluate ' + rule);
            out.push(null);
        } else {
            out.push(num);
        }
    }
    return out;
}

function replace_gene_in_rule (rule, gene_id, val) {
    // get the escaped string, with surrounding space or parentheses
    var space_or_par_start = '(^|[\\\s\\\(\\\)])'
    var space_or_par_finish = '([\\\s\\\(\\\)]|$)'
    var escaped = space_or_par_start + escape_reg_exp(gene_id) + space_or_par_finish
    return rule.replace(new RegExp(escaped, 'g'),  '$1' + val + '$2')

    // definitions
    function escape_reg_exp(string) {
        return string.replace(ESCAPE_REG, "\\$1")
    }
}

function apply_reaction_data_to_reactions(reactions, data, styles, compare_style) {
    /**  Returns True if the scale has changed.

     */

    var reaction_id, reaction, segment_id, segment;

    if (data === null) {
        for (reaction_id in reactions) {
            reaction = reactions[reaction_id];
            reaction.data = null;
            reaction.data_string = '';
            for (segment_id in reaction.segments) {
                segment = reaction.segments[segment_id];
                segment.data = null;
            }
            reaction.gene_string = null;
        }
        return false;
    }

    // apply the datasets to the reactions
    for (reaction_id in reactions) {
        reaction = reactions[reaction_id];
        // check bigg_id and name
        var d = data[reaction.bigg_id] || data[reaction.name] || null,
            f = float_for_data(d, styles, compare_style),
            r = reverse_flux_for_data(d),
            s = text_for_data(d, f);
        reaction.data = f;
        reaction.data_string = s;
        reaction.reverse_flux = r;
        reaction.gene_string = null;
        // apply to the segments
        for (segment_id in reaction.segments) {
            segment = reaction.segments[segment_id];
            segment.data = reaction.data;
            segment.reverse_flux = reaction.reverse_flux;
        }
    }
    return true;
}

function apply_metabolite_data_to_nodes(nodes, data, styles, compare_style) {
    /**  Returns True if the scale has changed.

     */

    var node_id;

    if (data === null) {
        for (node_id in nodes) {
            nodes[node_id].data = null;
            nodes[node_id].data_string = '';
        }
        return false;
    }

    // grab the data
    for (node_id in nodes) {
        var node = nodes[node_id];
            // check bigg_id and name
        var d = data[node.bigg_id] || data[node.name] || null,
            f = float_for_data(d, styles, compare_style),
            s = text_for_data(d, f);
        node.data = f;
        node.data_string = s;
    }
    return true;
}

function apply_gene_data_to_reactions(reactions, gene_data_obj, styles, identifiers_on_map,
                                      compare_style, and_method_in_gene_reaction_rule) {
    /** Returns true if data is present

     Arguments
     ---------

     reactions: The reactions to update.

     gene_data_obj: The gene data object, with the following style:

     { reaction_id: { gene_id: value } }

     styles:  Gene styles array.

     identifiers_on_map:

     compare_style:

     and_method_in_gene_reaction_rule:

     */

    if (gene_data_obj === null) {
        for (var reaction_id in reactions) {
            var reaction = reactions[reaction_id];
            reaction.data = null;
            reaction.data_string = '';
            reaction.reverse_flux = false;
            for (var segment_id in reaction.segments) {
                var segment = reaction.segments[segment_id];
                segment.data = null;
            }
            reaction.gene_string = null;
        }
        return false;
    }

    // get the null val
    var null_val = [null];
    // make an array of nulls as the default
    for (var reaction_id in gene_data_obj) {
        for (var gene_id in gene_data_obj[reaction_id]) {
            null_val = gene_data_obj[reaction_id][gene_id]
                .map(function() { return null; });
            break;
        }
        break;
    }

    // apply the datasets to the reactions
    for (var reaction_id in reactions) {
        var reaction = reactions[reaction_id],
            rule = reaction.gene_reaction_rule;
        // find the data
        var d, gene_values,
            r_data = gene_data_obj[reaction.bigg_id];
        if (typeof r_data !== 'undefined') {
            gene_values = r_data;
            d = evaluate_gene_reaction_rule(rule, gene_values,
                                            and_method_in_gene_reaction_rule);
        } else {
            gene_values = {};
            d = utils.clone(null_val);
        }
        var f = float_for_data(d, styles, compare_style),
            r = reverse_flux_for_data(d),
            s = text_for_data(d, f);
        reaction.data = f;
        reaction.data_string = s;
        reaction.reverse_flux = r;
        // apply to the segments
        for (var segment_id in reaction.segments) {
            var segment = reaction.segments[segment_id];
            segment.data = reaction.data;
            segment.reverse_flux = reaction.reverse_flux;
        }
        // always update the gene string
        reaction.gene_string = gene_string_for_data(rule,
                                                    gene_values,
                                                    reaction.genes,
                                                    styles,
                                                    identifiers_on_map,
                                                    compare_style);
    }
    return true;
}

function _parse_float_or_null(x) {
    // strict number casting
    var f = Number(x);
    // check for null and '', which haven't been caught yet
    return (isNaN(f) || parseFloat(x) != f) ? null : f;
}

},{"./utils":33,"underscore":38}],29:[function(require,module,exports){
module.exports = {'version': '1.6.0-beta.3', builder_embed: 'svg.escher-svg .gene-label,svg.escher-svg .label{text-rendering:optimizelegibility;cursor:default}svg.escher-svg #mouse-node{fill:none}svg.escher-svg #canvas{stroke:#ccc;stroke-width:7px;fill:#fff}svg.escher-svg .resize-rect{fill:#000;opacity:0;stroke:none}svg.escher-svg .label{font-family:sans-serif;font-style:italic;font-weight:700;font-size:8px;fill:#000;stroke:none}svg.escher-svg .reaction-label{font-size:30px;fill:#202078;text-rendering:optimizelegibility}svg.escher-svg .node-label{font-size:20px}svg.escher-svg .gene-label{font-size:18px;fill:#202078}svg.escher-svg .text-label .label,svg.escher-svg .text-label-input{font-size:50px}svg.escher-svg .node-circle{stroke-width:2px}svg.escher-svg .midmarker-circle,svg.escher-svg .multimarker-circle{fill:#fff;fill-opacity:.2;stroke:#323232}svg.escher-svg g.selected .node-circle{stroke-width:6px;stroke:#1471c7}svg.escher-svg g.selected .label{fill:#1471c7}svg.escher-svg .metabolite-circle{stroke:#a24510;fill:#e0865b}svg.escher-svg g.selected .metabolite-circle{stroke:#050200}svg.escher-svg .segment{stroke:#334E75;stroke-width:10px;fill:none}svg.escher-svg .arrowhead{fill:#334E75}svg.escher-svg .stoichiometry-label-rect{fill:#fff;opacity:.5}svg.escher-svg .stoichiometry-label{fill:#334E75;font-size:17px}svg.escher-svg .membrane{fill:none;stroke:#fb0}svg.escher-svg .brush .extent{fill-opacity:.1;fill:#000;stroke:#fff;shape-rendering:crispEdges}svg.escher-svg #brush-container .background{fill:none}svg.escher-svg .bezier-circle{fill:#fff}svg.escher-svg .bezier-circle.b1{stroke:red}svg.escher-svg .bezier-circle.b2{stroke:#00f}svg.escher-svg .connect-line{stroke:#c8c8c8}svg.escher-svg .direction-arrow{stroke:#000;stroke-width:1px;fill:#fff;opacity:.3}svg.escher-svg .start-reaction-cursor{cursor:pointer}svg.escher-svg .start-reaction-target{stroke:#646464;fill:none;opacity:.5}svg.escher-svg .rotation-center-line{stroke:red;stroke-width:5px}svg.escher-svg .highlight{fill:#D97000;text-decoration:underline}svg.escher-svg .cursor-grab{cursor:grab;cursor:-webkit-grab}svg.escher-svg .cursor-grabbing{cursor:grabbing;cursor:-webkit-grabbing}svg.escher-svg .edit-text-cursor{cursor:text}'};
},{}],30:[function(require,module,exports){
/**
* @license
*
* Escher
* Author: Zachary King
*
* The MIT License (MIT)
*
* This software is Copyright © 2015 The Regents of the University of
* California. All Rights Reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/

module.exports = {
  version: require('./inline').version,
  Builder: require('./Builder'),
  Map: require('./Map'),
  Behavior: require('./Behavior'),
  KeyManager: require('./KeyManager'),
  DataMenu: require('./DataMenu'),
  UndoStack: require('./UndoStack'),
  CobraModel: require('./CobraModel'),
  utils: require('./utils'),
  SearchIndex: require('./SearchIndex'),
  Settings: require('./Settings'),
  data_styles: require('./data_styles'),
  ui: require('./ui'),
  static: require('./static'),
  ZoomContainer: require('./ZoomContainer'),
  libs: {
    '_': require('underscore'),
    'underscore': require('underscore'),
    'tinier': require('tinier'),
    'baconjs': require('baconjs'),
    'mousetrap': require('mousetrap'),
    'vkbeautify': require('vkbeautify'),
  },
}

},{"./Behavior":1,"./Builder":4,"./CobraModel":7,"./DataMenu":8,"./KeyManager":11,"./Map":12,"./SearchIndex":18,"./Settings":19,"./UndoStack":24,"./ZoomContainer":25,"./data_styles":28,"./inline":29,"./static":31,"./ui":32,"./utils":33,"baconjs":34,"mousetrap":36,"tinier":37,"underscore":38,"vkbeautify":39}],31:[function(require,module,exports){
/** static */

/* global d3 */

var utils = require('./utils')

module.exports = {
    load_map_model_from_url: load_map_model_from_url
}

function load_map_model_from_url(map_download_url, model_download_url,
                                 local_index, options, callback) {
    var opt = utils.parse_url_components(window, options),
        to_load = [],
        load_map = function (fn) { fn(null); },
        load_model = function (fn) { fn(null); }
    if (opt.map_name) {
        var map_path = _get_path('map', opt.map_name,
                                 local_index, map_download_url)
        if (map_path) {
            load_map = function (fn) {
                d3.json(map_path, function(error, data) {
                    if (error) console.warn(error)
                    fn(data)
                })
            }
        }
    }
    if (opt.model_name) {
        var model_path = _get_path('model', opt.model_name,
                                   local_index, model_download_url)
        if (model_path) {
            load_model = function (fn) {
                d3.json(model_path, function(error, data) {
                    if (error) console.warn(error)
                    fn(data)
                })
            }
        }
    }
    if (opt.hasOwnProperty('enable_editing')) {
        options.enable_editing = opt.enable_editing.toLowerCase() === 'true'
    }
    load_map(function(map_data) {
        load_model(function(model_data) {
            callback(map_data, model_data, options)
        })
    })
}

function _get_path(kind, name, index, url) {
    var match = index[kind+'s'].filter(function(x) {
        return x[kind+'_name'] == name
    })
    if (match.length == 0)
        throw new Error('Bad ' + kind + ' ' + name)
    return (url + encodeURIComponent(match[0].organism) +
            '/' + encodeURIComponent(match[0][kind+'_name'])) + '.json'
}

},{"./utils":33}],32:[function(require,module,exports){
/** ui */

/* global d3 */

var utils = require('./utils');
var data_styles = require('./data_styles');

module.exports = {
    individual_button: individual_button,
    radio_button_group: radio_button_group,
    button_group: button_group,
    dropdown_menu: dropdown_menu,
    set_json_input_button: set_json_input_button,
    set_json_or_csv_input_button: set_json_or_csv_input_button
};

function _button_with_sel(b, button) {
    var ignore_bootstrap = button.ignore_bootstrap || false
    b.attr('class', 'btn btn-default simple-button')
    // icon
    var c = b.append('span')
    // text / bootstrap fallback
    var t = c.append('span')
    if ('id' in button) b.attr('id', button.id)
    if ('text' in button) t.text(button.text)
    if ('icon' in button && !ignore_bootstrap) c.classed(button.icon, true)
    if (!ignore_bootstrap) t.attr('class', 'hidden')
    if ('key' in button) set_button(b, button.key)

    // tooltip
    if ('key_text' in button && 'tooltip' in button && button.key_text !== null)
        b.attr('title', button.tooltip + button.key_text)
    else if ('tooltip' in button)
        b.attr('title', button.tooltip)
}

function individual_button(s, button) {
    var b = s.append('button')
    _button_with_sel(b, button)
}

function radio_button_group(s) {
    var s2 = s.append('li')
            .attr('class', 'btn-group-vertical')
            .attr('data-toggle', 'buttons')
    return { button: function(button) {
        var ignore_bootstrap = button.ignore_bootstrap || false
        var b = s2.append('label')
        b.append('input').attr('type', 'radio')
        _button_with_sel(b, button)
        return this
    }}
}

function button_group(s) {
    var s2 = s.attr('class', 'btn-group-vertical');
    return { button: function(button) {
        var b = s2.append("button")
        _button_with_sel(b, button)
        return this;
    }};
}

function dropdown_menu(s, name, pull_right) {
    if (pull_right === undefined) pull_right = false;
    var s2 = s.append('li')
            .attr('class', 'dropdown');
    s2.append('button').text(name+" ")
        .attr('class', 'btn btn-link btn-sm dropdown-button')
        .attr('data-toggle', 'dropdown')
        .append('b').attr('class', 'caret');
    var ul = s2.append('ul')
            .attr('class', 'dropdown-menu')
            .classed('pull-right', pull_right)
            .attr('role', 'menu')
            .attr('aria-labelledby', 'dLabel');
    return {
        dropdown: s2,
        button: function(button) {
            var li = ul.append("li")
                    .attr('role', 'presentation')
                    .datum(button),
                link = li.append("a")
                    .attr('href', '#'),
                icon = link.append('span')
                    .attr('class', 'dropdown-button-icon'),
                text = link.append('span')
                    .attr('class', 'dropdown-button-text');
            if ('id' in button) li.attr('id', button.id);

            // text
            if ('key_text' in button && 'text' in button && button.key_text !== null)
                text.text(" "+button.text + button.key_text);
            else if ('text' in button)
                text.text(" "+button.text);

            if ('icon' in button) icon.classed(button.icon, true);

            if ('key' in button) {
                set_button(link, button.key);
            } else if ('input' in button) {
                var input = button.input,
                    out = (input.accept_csv ?
                           set_json_or_csv_input_button(link, li, input.pre_fn,
                                                        input.fn, input.failure_fn) :
                           set_json_input_button(link, li, input.pre_fn,
                                                 input.fn, input.failure_fn));
                // assign a function to the key
                if ('assign' in input && 'key' in input)
                    input.assign[input.key] = out;
            }
            return this;
        },
        divider: function() {
            ul.append("li")
                .attr('role', 'presentation')
                .attr('class', 'divider');
            return this;
        }
    };
}

function set_button(b, key) {
    b.on("click", function() {
        key.fn.call(key.target);
    });
}

function set_json_input_button(b, s, pre_fn, post_fn, failure_fn) {
    var input = s.append("input")
            .attr("type", "file")
            .style("display", "none")
            .on("change", function() {
                utils.load_json(this.files[0],
                                function(e, d) {
                                    post_fn(e, d);
                                    this.value = "";
                                }.bind(this),
                                pre_fn,
                                failure_fn);
            });
    b.on('click', function(e) {
        input.node().click();
    });
    return function() { input.node().click(); };
}

function set_json_or_csv_input_button(b, s, pre_fn, post_fn, failure_fn) {
    var input = s.append("input")
            .attr("type", "file")
            .style("display", "none")
            .on("change", function() {
                utils.load_json_or_csv(this.files[0],
                                       data_styles.csv_converter,
                                       function(e, d) {
                                           post_fn(e, d);
                                           this.value = "";
                                       }.bind(this),
                                       pre_fn,
                                       failure_fn);
            });
    b.on('click', function(e) {
        input.node().click();
    });
    return function() { input.node().click(); };
}

},{"./data_styles":28,"./utils":33}],33:[function(require,module,exports){
/* global d3, Blob, XMLSerializer */

var vkbeautify = require('vkbeautify');
var _ = require('underscore');
try {
    var saveAs = require('filesaverjs').saveAs;
} catch (e) {
    console.warn('filesaverjs not available');
}


module.exports = {
    set_options: set_options,
    remove_child_nodes: remove_child_nodes,
    load_css: load_css,
    load_files: load_files,
    load_the_file: load_the_file,
    make_class: make_class,
    setup_defs: setup_defs,
    draw_an_object: draw_an_object,
    draw_a_nested_object: draw_a_nested_object,
    make_array: make_array,
    make_array_ref: make_array_ref,
    compare_arrays: compare_arrays,
    array_to_object: array_to_object,
    clone: clone,
    extend: extend,
    unique_concat: unique_concat,
    unique_strings_array: unique_strings_array,
    debounce: debounce,
    object_slice_for_ids: object_slice_for_ids,
    object_slice_for_ids_ref: object_slice_for_ids_ref,
    c_plus_c: c_plus_c,
    c_minus_c: c_minus_c,
    c_times_scalar: c_times_scalar,
    download_json: download_json,
    load_json: load_json,
    load_json_or_csv: load_json_or_csv,
    download_svg: download_svg,
    download_png: download_png,
    rotate_coords_recursive: rotate_coords_recursive,
    rotate_coords: rotate_coords,
    get_angle: get_angle,
    to_degrees: to_degrees,
    angle_for_event: angle_for_event,
    distance: distance,
    check_undefined: check_undefined,
    compartmentalize: compartmentalize,
    decompartmentalize: decompartmentalize,
    mean: mean,
    median: median,
    quartiles: quartiles,
    random_characters: random_characters,
    generate_map_id: generate_map_id,
    check_for_parent_tag: check_for_parent_tag,
    name_to_url: name_to_url,
    parse_url_components: parse_url_components,
    get_document: get_document,
    get_window: get_window,
    d3_transform_catch: d3_transform_catch,
    check_browser: check_browser
};


// definitions
function _check_filesaver() {
    /** Check if Blob is available, and alert if it is not. */
    try {
        var isFileSaverSupported = !!new Blob();
    } catch (e) {
        alert("Blob not supported");
    }
}

function set_options(options, defaults, must_be_float) {
    if (options === undefined || options === null)
        return defaults;
    var i = -1,
        out = {};
    for (var key in defaults) {
        var has_key = ((key in options) &&
                       (options[key] !== null) &&
                       (options[key] !== undefined));
        var val = (has_key ? options[key] : defaults[key]);
        if (must_be_float && key in must_be_float) {
            val = parseFloat(val);
            if (isNaN(val)) {
                if (has_key) {
                    console.warn('Bad float for option ' + key);
                    val = parseFloat(defaults[key]);
                    if (isNaN(val)) {
                        console.warn('Bad float for default ' + key);
                        val = null;
                    }
                } else {
                    console.warn('Bad float for default ' + key);
                    val = null;
                }
            }
        }
        out[key] = val;
    }
    return out;
}


function remove_child_nodes(selection) {
    /** Removes all child nodes from a d3 selection

     */
    var node = selection.node();
    while (node.hasChildNodes()) {
        node.removeChild(node.lastChild);
    }
}


function load_css(css_path, callback) {
    var css = "";
    if (css_path) {
        d3.text(css_path, function(error, text) {
            if (error) {
                console.warn(error);
            }
            css = text;
            callback(css);
        });
    }
    return false;
};


function load_the_file(t, file, callback, value) {
    /** Load a file.

     t: this context for callback. Should be an object.

     files_to_load: A filename to load. Must be JSON or CSS.

     callback: Function to run after the file is loaded. Takes the arguments
     error and data.

     value: If the value is specified, just assign it and do not execute the
     ajax query.

     */
    if (value) {
        if (file) console.warn('File ' + file + ' overridden by value.');
        callback.call(t, null, value);
        return;
    }
    if (!file) {
        callback.call(t, 'No filename', null);
        return;
    }
    if (ends_with(file, 'json'))
        d3.json(file, function(e, d) { callback.call(t, e, d); });
    else if (ends_with(file, 'css'))
        d3.text(file, function(e, d) { callback.call(t, e, d); });
    else
        callback.call(t, 'Unrecognized file type', null);
    return;

    // definitions
    function ends_with(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }
}


function load_files(t, files_to_load, final_callback) {
    /** Load multiple files asynchronously by calling utils.load_the_file.

     t: this context for callback. Should be an object.

     files_to_load: A list of objects with the attributes:

        { file: a_filename.json, callback: a_callback_fn }

        File must be JSON or CSS.

     final_callback: Function that runs after all files have loaded.

     */
    if (files_to_load.length === 0) final_callback.call(t);
    var i = -1,
        remaining = files_to_load.length;
    while (++i < files_to_load.length) {
        load_the_file(
            t,
            files_to_load[i].file,
            function(e, d) {
                this.call(t, e, d);
                if (!--remaining) final_callback.call(t);
            }.bind(files_to_load[i].callback),
            files_to_load[i].value
        );
    }
}


function make_class(){
    /** Create a constructor that returns a new object with our without the
     'new' keyword.

     Adapted from Hubert Kauker (MIT Licensed), John Resig (MIT Licensed).
     http://stackoverflow.com/questions/7892884/simple-class-instantiation

     */
    var is_internal,
        constructor = function(args) {
            if (this instanceof constructor) {
                if (typeof this.init === 'function') {
                    this.init.apply(this, is_internal ? args : arguments);
                }
            } else {
                is_internal = true;
                var instance = new constructor(arguments);
                is_internal = false;
                return instance;
            }
        };
    return constructor;
}


function setup_defs(svg, style) {
    // add stylesheet
    svg.select("defs").remove();
    var defs = svg.append("defs");
    // make sure the defs is the first node
    var node = defs.node();
    node.parentNode.insertBefore(node, node.parentNode.firstChild);
    defs.append("style")
        .attr("type", "text/css")
        .text(style);
    return defs;
}

function draw_an_object(container_sel, parent_node_selector, children_selector,
                        object, id_key, create_function, update_function,
                        exit_function) {
    /** Run through the d3 data binding steps for an object. Also checks to
     make sure none of the values in the *object* are undefined, and
     ignores those.

     The create_function, update_function, and exit_function CAN modify the
     input data object.

     Arguments
     ---------

     container_sel: A d3 selection containing all objects.

     parent_node_selector: A selector string for a subselection of
     container_sel.

     children_selector: A selector string for each DOM element to bind.

     object: An object to bind to the selection.

     id_key: The key that will be used to store object IDs in the bound data
     points.

     create_function: A function for enter selection.

     update_function: A function for update selection.

     exit_function: A function for exit selection.

     */
    var draw_object = {};
    for (var id in object) {
        if (object[id] === undefined) {
            console.warn('Undefined value for id ' + id + ' in object. Ignoring.');
        } else {
            draw_object[id] = object[id];
        }
    }

    var sel = container_sel.select(parent_node_selector)
            .selectAll(children_selector)
            .data(make_array_ref(draw_object, id_key),
                  function(d) { return d[id_key]; });
    // enter: generate and place reaction
    if (create_function)
        sel.enter().call(create_function);
    // update: update when necessary
    if (update_function)
        sel.call(update_function);
    // exit
    if (exit_function)
        sel.exit().call(exit_function);
}

function draw_a_nested_object(container_sel, children_selector, object_data_key,
                              id_key, create_function, update_function,
                              exit_function) {
    /** Run through the d3 data binding steps for an object that is nested
     within another element with d3 data.

     The create_function, update_function, and exit_function CAN modify the
     input data object.

     Arguments
     ---------

     container_sel: A d3 selection containing all objects.

     children_selector: A selector string for each DOM element to bind.

     object_data_key: A key for the parent object containing data for the
     new selection.

     id_key: The key that will be used to store object IDs in the bound data
     points.

     create_function: A function for enter selection.

     update_function: A function for update selection.

     exit_function: A function for exit selection.

     */
    var sel = container_sel.selectAll(children_selector)
            .data(function(d) {
                return make_array_ref(d[object_data_key], id_key);
            }, function(d) { return d[id_key]; });
    // enter: generate and place reaction
    if (create_function)
        sel.enter().call(create_function);
    // update: update when necessary
    if (update_function)
        sel.call(update_function);
    // exit
    if (exit_function)
        sel.exit().call(exit_function);
}

function make_array(obj, id_key) { // is this super slow?
    var array = [];
    for (var key in obj) {
        // copy object
        var it = clone(obj[key]);
        // add key as 'id'
        it[id_key] = key;
        // add object to array
        array.push(it);
    }
    return array;
}

function make_array_ref(obj, id_key) {
    /** Turn the object into an array, but only by reference. Faster than
     make_array.

     */
    var array = [];
    for (var key in obj) {
        // copy object
        var it = obj[key];
        // add key as 'id'
        it[id_key] = key;
        // add object to array
        array.push(it);
    }
    return array;
}

function compare_arrays(a1, a2) {
    /** Compares two simple (not-nested) arrays.

     */
    if (!a1 || !a2) return false;
    if (a1.length != a2.length) return false;
    for (var i = 0, l=a1.length; i < l; i++) {
        if (a1[i] != a2[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
}

function array_to_object(arr) {
    /** Convert an array of objects to an object with all keys and values
     that are arrays of the same length as arr. Fills in spaces with null.

     For example, [ { a: 1 }, { b: 2 }] becomes { a: [1, null], b: [null, 2] }.

     */
    // new object
    var obj = {};
    // for each element of the array
    for (var i = 0, l = arr.length; i < l; i++) {
        var column = arr[i],
            keys = Object.keys(column);
        for (var k = 0, nk = keys.length; k < nk; k++) {
            var id = keys[k];
            if (!(id in obj)) {
                var n = [];
                // fill spaces with null
                for (var j = 0; j < l; j++) {
                    n[j] = null;
                }
                n[i] = column[id];
                obj[id] = n;
            } else {
                obj[id][i] = column[id];
            }
        }
    }
    return obj;
}

/**
 * Deep copy for array and object types. All other types are returned by
 * reference.
 * @param {T<Object|Array|*>} obj - The object to copy.
 * @return {T} The copied object.
 */
function clone (obj) {
    if (_.isArray(obj))
        return _.map(obj, function(t) { return clone(t) })
    else if (_.isObject(obj))
        return _.mapObject(obj, function (t, k) { return clone(t) })
    else
        return obj
}

function extend(obj1, obj2, overwrite) {
    /** Extends obj1 with keys/values from obj2. Performs the extension
     cautiously, and does not override attributes, unless the overwrite
     argument is true.

     Arguments
     ---------

     obj1: Object to extend

     obj2: Object with which to extend.

     overwrite: (Optional, Default false) Overwrite attributes in obj1.

     */

    if (overwrite === undefined)
        overwrite = false;

    for (var attrname in obj2) {
        if (!(attrname in obj1) || overwrite) // UNIT TEST This
            obj1[attrname] = obj2[attrname];
        else
            throw new Error('Attribute ' + attrname + ' already in object.');
    }
}

function unique_concat(arrays) {
    var new_array = [];
    arrays.forEach(function (a) {
        a.forEach(function(x) {
            if (new_array.indexOf(x) < 0)
                new_array.push(x);
        });
    });
    return new_array;
}

function unique_strings_array(arr) {
    /** Return unique values in array of strings.

     http://stackoverflow.com/questions/1960473/unique-values-in-an-array

     */
    var a = [];
    for (var i = 0, l = arr.length; i < l; i++)
        if (a.indexOf(arr[i]) === -1)
            a.push(arr[i]);
    return a;
}

function debounce(func, wait, immediate) {
    /** Returns a function, that, as long as it continues to be invoked, will
     not be triggered.

     The function will be called after it stops being called for N
     milliseconds. If `immediate` is passed, trigger the function on the leading
     edge, instead of the trailing.

     */
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

function object_slice_for_ids(obj, ids) {
    /** Return a copy of the object with just the given ids.

     Arguments
     ---------

     obj: An object.

     ids: An array of id strings.

     */
    var subset = {}, i = -1;
    while (++i<ids.length) {
        subset[ids[i]] = clone(obj[ids[i]]);
    }
    if (ids.length != Object.keys(subset).length) {
        console.warn('did not find correct reaction subset');
    }
    return subset;
}

function object_slice_for_ids_ref(obj, ids) {
    /** Return a reference of the object with just the given ids. Faster
     than object_slice_for_ids.

     Arguments
     ---------

     obj: An object.

     ids: An array of id strings.

     */
    var subset = {}, i = -1;
    while (++i<ids.length) {
        subset[ids[i]] = obj[ids[i]];
    }
    if (ids.length != Object.keys(subset).length) {
        console.warn('did not find correct reaction subset');
    }
    return subset;
}

function c_plus_c(coords1, coords2) {
    if (coords1 === null || coords2 === null ||
        coords1 === undefined || coords2 === undefined)
        return null;
    return { "x": coords1.x + coords2.x,
             "y": coords1.y + coords2.y };
}
function c_minus_c(coords1, coords2) {
    if (coords1 === null || coords2 === null ||
        coords1 === undefined || coords2 === undefined)
        return null;
    return { "x": coords1.x - coords2.x,
             "y": coords1.y - coords2.y };
}

function c_times_scalar(coords, scalar) {
    return { "x": coords.x * scalar,
             "y": coords.y * scalar };
}

function download_json(json, name) {
    /** Download json file in a blob.

     */

    // alert if blob isn't going to work
    _check_filesaver();

    var j = JSON.stringify(json),
        blob = new Blob([j], {type: "application/json"});
    saveAs(blob, name + '.json');
}

function load_json(f, callback, pre_fn, failure_fn) {
    /** Try to load the file as JSON.

     Arguments
     ---------

     f: The file path

     callback: A callback function that accepts arguments: error, data.

     pre_fn: (optional) A function to call before loading the data.

     failure_fn: (optional) A function to call if the load fails or is aborted.

     */
    // Check for the various File API support.
    if (!(window.File && window.FileReader && window.FileList && window.Blob))
        callback("The File APIs are not fully supported in this browser.", null);

    var reader = new window.FileReader();
    // Closure to capture the file information.
    reader.onload = function(event) {
        var result = event.target.result,
            data;
        // try JSON
        try {
            data = JSON.parse(result);
        } catch (e) {
            // if it failed, return the error
            callback(e, null);
            return;
        }
        // if successful, return the data
        callback(null, data);
    };
    if (pre_fn !== undefined && pre_fn !== null) {
        try { pre_fn(); }
        catch (e) { console.warn(e); }
    }
    reader.onabort = function(event) {
        try { failure_fn(); }
        catch (e) { console.warn(e); }
    };
    reader.onerror = function(event) {
        try { failure_fn(); }
        catch (e) { console.warn(e); }
    };
    // Read in the image file as a data URL.
    reader.readAsText(f);
}

function load_json_or_csv(f, csv_converter, callback, pre_fn, failure_fn,
                          debug_event) {
    /** Try to load the file as JSON or CSV (JSON first).

     Arguments
     ---------

     f: The file path

     csv_converter: A function to convert the CSV output to equivalent JSON.

     callback: A callback function that accepts arguments: error, data.

     pre_fn: (optional) A function to call before loading the data.

     failure_fn: (optional) A function to call if the load fails or is aborted.

     debug_event: (optional) An event, with a string at event.target.result, to
     load as though it was the contents of a loaded file.

     */

    // Capture the file information.
    var onload_function = function(event) {
        var result = event.target.result,
            data, errors;
        // try JSON
        try {
            data = JSON.parse(result);
        } catch (e) {
            errors = 'JSON error: ' + e;

            // try csv
            try {
                data = csv_converter(d3.csv.parseRows(result));
            } catch (e) {
                // if both failed, return the errors
                callback(errors + '\nCSV error: ' + e, null);
                return;
            }
        }
        // if successful, return the data
        callback(null, data);
    };
    if (debug_event !== undefined && debug_event !== null) {
        console.warn('Debugging load_json_or_csv');
        return onload_function(debug_event);
    }

    // Check for the various File API support.
    if (!(window.File && window.FileReader && window.FileList && window.Blob))
        callback("The File APIs are not fully supported in this browser.", null);
    var reader = new window.FileReader();

    if (pre_fn !== undefined && pre_fn !== null) {
        try { pre_fn(); }
        catch (e) { console.warn(e); }
    }
    reader.onabort = function(event) {
        try { failure_fn(); }
        catch (e) { console.warn(e); }
    };
    reader.onerror = function(event) {
        try { failure_fn(); }
        catch (e) { console.warn(e); }
    };
    // Read in the image file as a data URL.
    reader.onload = onload_function;
    reader.readAsText(f);
}

function download_svg(name, svg_sel, do_beautify) {
    /** Download an svg file using FileSaver.js.
     *
     * Arguments
     * ---------
     *
     * name: The filename (without extension).
     *
     * svg_sel: The d3 selection for the SVG element.
     *
     * do_beautify: (Boolean) If true, then beautify the SVG output.
     *
     */

    // alert if blob isn't going to work
    _check_filesaver();

    // make the xml string
    var xml = (new XMLSerializer()).serializeToString(svg_sel.node());
    if (do_beautify) xml = vkbeautify.xml(xml);
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n' +
           '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n' +
           ' "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
           xml);

    // save
    var blob = new Blob([xml], { type: 'image/svg+xml' });
    saveAs(blob, name + '.svg');
};

function download_png(name, svg_sel, do_beautify) {
    /** Download a png file using FileSaver.js.
     *
     * Arguments
     * ---------
     *
     * name: The filename (without extension).
     *
     * svg_sel: The d3 selection for the SVG element.
     *
     * do_beautify: (Boolean) If true, then beautify the SVG output.
     *
     */

    // Alert if blob isn't going to work
    _check_filesaver();

    // Make the xml string
    var xml = (new XMLSerializer()).serializeToString(svg_sel.node());
    if (do_beautify) xml = vkbeautify.xml(xml);
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n' +
           '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n' +
           ' "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
           xml);

    // Canvas to hold the image
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');

    // Get SVG size
    var svg_size = svg_sel.node().getBBox();
    var svg_width = svg_size.width + svg_size.x;
    var svg_height = svg_size.height + svg_size.y;

    // Canvas size = SVG size. Constrained to 10000px for very large SVGs
    if (svg_width < 10000 && svg_height < 10000) {
        canvas.width = svg_width;
        canvas.height = svg_height;
    } else {
        if (canvas.width > canvas.height) {
            canvas.width = 10000;
            canvas.height = 10000*(svg_height/svg_width);
        } else {
            canvas.width = 10000*(svg_width/svg_height);
            canvas.height = 10000;
        }
    }

    // Image element appended with data
    var base_image = new Image();
    base_image.src = 'data:image/svg+xml;base64,' + btoa(xml);

    base_image.onload = function() {
        // Draw image to canvas with white background
        context.fillStyle="#FFF";
        context.fillRect( 0, 0, canvas.width, canvas.height);
        context.drawImage(base_image, 0, 0, canvas.width, canvas.height);

        // Save image
        canvas.toBlob(function(blob) {
            saveAs(blob, name + ".png");
        });
    };
};

function rotate_coords_recursive(coords_array, angle, center) {
    var rot = function(c) { return rotate_coords(c, angle, center); };
    return coords_array.map(rot);
}

function rotate_coords(c, angle, center) {
    /** Calculates displacement { x: dx, y: dy } based on rotating point c around
     center with angle.

     */
    var dx = Math.cos(-angle) * (c.x - center.x) +
            Math.sin(-angle) * (c.y - center.y)
            + center.x - c.x,
        dy = - Math.sin(-angle) * (c.x - center.x) +
            Math.cos(-angle) * (c.y - center.y)
            + center.y - c.y;
    return { x: dx, y: dy };
}

function get_angle(coords) {
    /* Takes an array of 2 coordinate objects {"x": 1, "y": 1}
     *
     * Returns angle between 0 and 2PI.
     */
    var denominator = coords[1].x - coords[0].x,
        numerator = coords[1].y - coords[0].y;
    if (denominator==0 && numerator >= 0) return Math.PI/2;
    else if (denominator==0 && numerator < 0) return 3*Math.PI/2;
    else if (denominator >= 0 && numerator >= 0) return Math.atan(numerator/denominator);
    else if (denominator >= 0) return (Math.atan(numerator/denominator) + 2*Math.PI);
    else return (Math.atan(numerator/denominator) + Math.PI);
}

function to_degrees(radians) { return radians*180/Math.PI; }

function angle_for_event(displacement, point, center) {
    var gamma =  Math.atan2((point.x - center.x), (center.y - point.y)),
        beta = Math.atan2((point.x - center.x + displacement.x),
                          (center.y - point.y - displacement.y)),
        angle = beta - gamma;
    return angle;
}

function distance(start, end) { return Math.sqrt(Math.pow(end.y-start.y, 2) + Math.pow(end.x-start.x, 2)); }

function check_undefined(args, names) {
    /** Report an error if any of the arguments are undefined.

     Call by passing in *arguments* from any function and an array of
     argument names.

     */
    names.map(function(name, i) {
        if (args[i]===undefined) {
            console.error('Argument is undefined: '+String(names[i]));
        }
    });
}

function compartmentalize(bigg_id, compartment_id) {
    return bigg_id + '_' + compartment_id;
}


// definitions
function decompartmentalize(id) {
    /** Convert ids to bigg_id and compartment_id.

     */
    var out = no_compartment(id);
    if (out===null) out = [id, null];
    return out;

    // definitions
    function no_compartment(id) {
        /** Returns an array of [bigg_id, compartment id].

         Matches compartment ids with length 1 or 2.

         Return null if no match is found.

         */
        var reg = /(.*)_([a-z0-9]{1,2})$/,
            result = reg.exec(id);
        if (result===null) return null;
        return result.slice(1,3);
    }
}

function mean(array) {
    var sum = array.reduce(function(a, b) { return a + b; });
    var avg = sum / array.length;
    return avg;
}

function median(array) {
    array.sort(function(a, b) { return a - b; });
    var half = Math.floor(array.length / 2);
    if(array.length % 2 == 1)
        return array[half];
    else
        return (array[half-1] + array[half]) / 2.0;
}

function quartiles(array) {
    array.sort(function(a, b) { return a - b; });
    var half = Math.floor(array.length / 2);
    if (array.length == 1)
        return [ array[0], array[0], array[0] ];
    else if (array.length % 2 == 1)
        return [ median(array.slice(0, half)),
                 array[half],
                 median(array.slice(half + 1)) ];
    else
        return [ median(array.slice(0, half)),
                 (array[half-1] + array[half]) / 2.0,
                 median(array.slice(half)) ];
}

function random_characters(num) {
    // Thanks to @csharptest.net
    // http://stackoverflow.com/questions/1349404/generate-a-string-of-5-random-characters-in-javascript
    var text = '',
        possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < num; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

function generate_map_id() {
    return random_characters(12);
}

function check_for_parent_tag(el, tag) {
    /** Check that the selection has the given parent tag.

     el: A d3 selection or node.

     tag: A tag name (case insensitive)

     */
    // make sure it is a node
    if (el instanceof Array)
        el = el.node();
    while (el.parentNode !== null) {
        el = el.parentNode;
        if (el.tagName === undefined) continue;
        if (el.tagName.toLowerCase() === tag.toLowerCase())
            return true;
    }
    return false;
}

function name_to_url(name, download_url) {
    /** Convert model or map name to url.

     Arguments
     ---------

     name: The short name, e.g. e_coli.iJO1366.central_metabolism.

     download_url: The url to prepend (optional).

     */

    if (download_url !== undefined && download_url !== null) {
        // strip download_url
        download_url = download_url.replace(/^\/|\/$/g, '');
        name = [download_url, name].join('/');
    }
    // strip final path
    return name.replace(/^\/|\/$/g, '') + '.json';
}

function parse_url_components(the_window, options) {
    /** Parse the URL and return options based on the URL arguments.

     Arguments
     ---------

     the_window: A reference to the global window.

     options: (optional) an existing options object to which new options
     will be added. Overwrites existing arguments in options.

     Adapted from http://stackoverflow.com/questions/979975/how-to-get-the-value-from-url-parameter

     */
    if (_.isUndefined(options)) options = {}

    var query = the_window.location.search.substring(1),
        vars = query.split('&')
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('='),
            val = decodeURIComponent(pair[1])
        // deal with array options
        if (pair[0].indexOf('[]') == pair[0].length - 2) {
            var o = pair[0].replace('[]', '')
            if (!(o in options))
                options[o] = []
            options[o].push(val)
        } else {
            options[pair[0]] = val
        }
    }
    return options
}


function get_document(node) {
    /** Get the document for the node */
    return node.ownerDocument;
}

function get_window(node) {
    /** Get the window for the node */
    return get_document(node).defaultView;
}

function d3_transform_catch(transform_attr) {
    /** Return the result of d3.transform, but catch errors if we are in
     node/jsdom. See also https://github.com/mbostock/d3/issues/1545

     */
    try {
        return d3.transform(transform_attr);
    } catch (err) {
        console.error('Cannot run d3.transform, probably becuase this is a node/jsdom test. ' +
                      'Returning a tranform object for testing.');
        return { translate: [0, 0], rotate: 0 };
    }
}

function check_browser(name) {
    /** Look for name in the user agent string */
    var browser = function() {
        /** Thanks to http://stackoverflow.com/questions/2400935/browser-detection-in-javascript */
        var ua = navigator.userAgent,
            M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [],
            tem;
        if (/trident/i.test(M[1])) {
            tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
            return 'IE '+ (tem[1] || '');
        }
        if (M[1] === 'Chrome') {
            tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
            if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
        }
        M = M[2] ? [ M[1], M[2] ]: [ navigator.appName, navigator.appVersion, '-?' ];
        if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
        return M.join(' ');
    };

    try {
        // navigator.userAgent is deprecated, so don't count on it
        return browser().toLowerCase().indexOf(name) > -1;
    } catch (e) {
        return false;
    }
}

},{"filesaverjs":35,"underscore":38,"vkbeautify":39}],34:[function(require,module,exports){
(function (global){
(function() {
var _slice = Array.prototype.slice;
var Bacon = {
  toString: function () {
    return "Bacon";
  }
};

Bacon.version = '0.7.89';

var Exception = (typeof global !== "undefined" && global !== null ? global : this).Error;
var nop = function () {};
var latter = function (_, x) {
  return x;
};
var former = function (x, _) {
  return x;
};
var cloneArray = function (xs) {
  return xs.slice(0);
};
var assert = function (message, condition) {
  if (!condition) {
    throw new Exception(message);
  }
};
var assertObservableIsProperty = function (x) {
  if ((x != null ? x._isObservable : void 0) && !(x != null ? x._isProperty : void 0)) {
    throw new Exception("Observable is not a Property : " + x);
  }
};
var assertEventStream = function (event) {
  if (!(event != null ? event._isEventStream : void 0)) {
    throw new Exception("not an EventStream : " + event);
  }
};

var assertObservable = function (event) {
  if (!(event != null ? event._isObservable : void 0)) {
    throw new Exception("not an Observable : " + event);
  }
};
var assertFunction = function (f) {
  return assert("not a function : " + f, _.isFunction(f));
};
var isArray = Array.isArray || function (xs) {
  return xs instanceof Array;
};
var isObservable = function (x) {
  return x && x._isObservable;
};
var assertArray = function (xs) {
  if (!isArray(xs)) {
    throw new Exception("not an array : " + xs);
  }
};
var assertNoArguments = function (args) {
  return assert("no arguments supported", args.length === 0);
};
var assertString = function (x) {
  if (typeof x === "string") {
    throw new Exception("not a string : " + x);
  }
};

var extend = function (target) {
  var length = arguments.length;
  for (var i = 1; 1 < length ? i < length : i > length; 1 < length ? i++ : i--) {
    for (var prop in arguments[i]) {
      target[prop] = arguments[i][prop];
    }
  }
  return target;
};

var inherit = function (child, parent) {
  var hasProp = ({}).hasOwnProperty;
  var ctor = function () {};
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
  for (var key in parent) {
    if (hasProp.call(parent, key)) {
      child[key] = parent[key];
    }
  }
  return child;
};

var _ = {
  indexOf: (function () {
    if (Array.prototype.indexOf) {
      return function (xs, x) {
        return xs.indexOf(x);
      };
    } else {
      return function (xs, x) {
        for (var i = 0, y; i < xs.length; i++) {
          y = xs[i];
          if (x === y) {
            return i;
          }
        }
        return -1;
      };
    }
  })(),
  indexWhere: function (xs, f) {
    for (var i = 0, y; i < xs.length; i++) {
      y = xs[i];
      if (f(y)) {
        return i;
      }
    }
    return -1;
  },
  head: function (xs) {
    return xs[0];
  },
  always: function (x) {
    return function () {
      return x;
    };
  },
  negate: function (f) {
    return function (x) {
      return !f(x);
    };
  },
  empty: function (xs) {
    return xs.length === 0;
  },
  tail: function (xs) {
    return xs.slice(1, xs.length);
  },
  filter: function (f, xs) {
    var filtered = [];
    for (var i = 0, x; i < xs.length; i++) {
      x = xs[i];
      if (f(x)) {
        filtered.push(x);
      }
    }
    return filtered;
  },
  map: function (f, xs) {
    return (function () {
      var result = [];
      for (var i = 0, x; i < xs.length; i++) {
        x = xs[i];
        result.push(f(x));
      }
      return result;
    })();
  },
  each: function (xs, f) {
    for (var key in xs) {
      if (Object.prototype.hasOwnProperty.call(xs, key)) {
        var value = xs[key];
        f(key, value);
      }
    }
  },
  toArray: function (xs) {
    return isArray(xs) ? xs : [xs];
  },
  contains: function (xs, x) {
    return _.indexOf(xs, x) !== -1;
  },
  id: function (x) {
    return x;
  },
  last: function (xs) {
    return xs[xs.length - 1];
  },
  all: function (xs) {
    var f = arguments.length <= 1 || arguments[1] === undefined ? _.id : arguments[1];

    for (var i = 0, x; i < xs.length; i++) {
      x = xs[i];
      if (!f(x)) {
        return false;
      }
    }
    return true;
  },
  any: function (xs) {
    var f = arguments.length <= 1 || arguments[1] === undefined ? _.id : arguments[1];

    for (var i = 0, x; i < xs.length; i++) {
      x = xs[i];
      if (f(x)) {
        return true;
      }
    }
    return false;
  },
  without: function (x, xs) {
    return _.filter(function (y) {
      return y !== x;
    }, xs);
  },
  remove: function (x, xs) {
    var i = _.indexOf(xs, x);
    if (i >= 0) {
      return xs.splice(i, 1);
    }
  },
  fold: function (xs, seed, f) {
    for (var i = 0, x; i < xs.length; i++) {
      x = xs[i];
      seed = f(seed, x);
    }
    return seed;
  },
  flatMap: function (f, xs) {
    return _.fold(xs, [], function (ys, x) {
      return ys.concat(f(x));
    });
  },
  cached: function (f) {
    var value = None;
    return function () {
      if (typeof value !== "undefined" && value !== null ? value._isNone : undefined) {
        value = f();
        f = undefined;
      }
      return value;
    };
  },
  bind: function (fn, me) {
    return function () {
      return fn.apply(me, arguments);
    };
  },
  isFunction: function (f) {
    return typeof f === "function";
  },
  toString: function (obj) {
    var internals, key, value;
    var hasProp = ({}).hasOwnProperty;
    try {
      recursionDepth++;
      if (obj == null) {
        return "undefined";
      } else if (_.isFunction(obj)) {
        return "function";
      } else if (isArray(obj)) {
        if (recursionDepth > 5) {
          return "[..]";
        }
        return "[" + _.map(_.toString, obj).toString() + "]";
      } else if ((obj != null ? obj.toString : void 0) != null && obj.toString !== Object.prototype.toString) {
        return obj.toString();
      } else if (typeof obj === "object") {
        if (recursionDepth > 5) {
          return "{..}";
        }
        internals = (function () {
          var results = [];
          for (key in obj) {
            if (!hasProp.call(obj, key)) continue;
            value = (function () {
              var error;
              try {
                return obj[key];
              } catch (error) {
                return error;
              }
            })();
            results.push(_.toString(key) + ":" + _.toString(value));
          }
          return results;
        })();
        return "{" + internals + "}";
      } else {
        return obj;
      }
    } finally {
      recursionDepth--;
    }
  }
};

var recursionDepth = 0;

Bacon._ = _;

var UpdateBarrier = Bacon.UpdateBarrier = (function () {
  var rootEvent;
  var waiterObs = [];
  var waiters = {};
  var afters = [];
  var aftersIndex = 0;
  var flushed = {};

  var afterTransaction = function (f) {
    if (rootEvent) {
      return afters.push(f);
    } else {
      return f();
    }
  };

  var whenDoneWith = function (obs, f) {
    if (rootEvent) {
      var obsWaiters = waiters[obs.id];
      if (!(typeof obsWaiters !== "undefined" && obsWaiters !== null)) {
        obsWaiters = waiters[obs.id] = [f];
        return waiterObs.push(obs);
      } else {
        return obsWaiters.push(f);
      }
    } else {
      return f();
    }
  };

  var flush = function () {
    while (waiterObs.length > 0) {
      flushWaiters(0, true);
    }
    flushed = {};
  };

  var flushWaiters = function (index, deps) {
    var obs = waiterObs[index];
    var obsId = obs.id;
    var obsWaiters = waiters[obsId];
    waiterObs.splice(index, 1);
    delete waiters[obsId];
    if (deps && waiterObs.length > 0) {
      flushDepsOf(obs);
    }
    for (var i = 0, f; i < obsWaiters.length; i++) {
      f = obsWaiters[i];
      f();
    }
  };

  var flushDepsOf = function (obs) {
    if (flushed[obs.id]) return;
    var deps = obs.internalDeps();
    for (var i = 0, dep; i < deps.length; i++) {
      dep = deps[i];
      flushDepsOf(dep);
      if (waiters[dep.id]) {
        var index = _.indexOf(waiterObs, dep);
        flushWaiters(index, false);
      }
    }
    flushed[obs.id] = true;
  };

  var inTransaction = function (event, context, f, args) {
    if (rootEvent) {
      return f.apply(context, args);
    } else {
      rootEvent = event;
      try {
        var result = f.apply(context, args);

        flush();
      } finally {
        rootEvent = undefined;
        while (aftersIndex < afters.length) {
          var after = afters[aftersIndex];
          aftersIndex++;
          after();
        }
        aftersIndex = 0;
        afters = [];
      }
      return result;
    }
  };

  var currentEventId = function () {
    return rootEvent ? rootEvent.id : undefined;
  };

  var wrappedSubscribe = function (obs, sink) {
    var unsubd = false;
    var shouldUnsub = false;
    var doUnsub = function () {
      shouldUnsub = true;
      return shouldUnsub;
    };
    var unsub = function () {
      unsubd = true;
      return doUnsub();
    };
    doUnsub = obs.dispatcher.subscribe(function (event) {
      return afterTransaction(function () {
        if (!unsubd) {
          var reply = sink(event);
          if (reply === Bacon.noMore) {
            return unsub();
          }
        }
      });
    });
    if (shouldUnsub) {
      doUnsub();
    }
    return unsub;
  };

  var hasWaiters = function () {
    return waiterObs.length > 0;
  };

  return { whenDoneWith: whenDoneWith, hasWaiters: hasWaiters, inTransaction: inTransaction, currentEventId: currentEventId, wrappedSubscribe: wrappedSubscribe, afterTransaction: afterTransaction };
})();

function Source(obs, sync) {
  var lazy = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  this.obs = obs;
  this.sync = sync;
  this.lazy = lazy;
  this.queue = [];
}

extend(Source.prototype, {
  _isSource: true,

  subscribe: function (sink) {
    return this.obs.dispatcher.subscribe(sink);
  },
  toString: function () {
    return this.obs.toString();
  },
  markEnded: function () {
    this.ended = true;
    return true;
  },
  consume: function () {
    if (this.lazy) {
      return { value: _.always(this.queue[0]) };
    } else {
      return this.queue[0];
    }
  },
  push: function (x) {
    this.queue = [x];
    return [x];
  },
  mayHave: function () {
    return true;
  },
  hasAtLeast: function () {
    return this.queue.length;
  },
  flatten: true
});

function ConsumingSource() {
  Source.apply(this, arguments);
}

inherit(ConsumingSource, Source);
extend(ConsumingSource.prototype, {
  consume: function () {
    return this.queue.shift();
  },
  push: function (x) {
    return this.queue.push(x);
  },
  mayHave: function (c) {
    return !this.ended || this.queue.length >= c;
  },
  hasAtLeast: function (c) {
    return this.queue.length >= c;
  },
  flatten: false
});

function BufferingSource(obs) {
  Source.call(this, obs, true);
}

inherit(BufferingSource, Source);
extend(BufferingSource.prototype, {
  consume: function () {
    var values = this.queue;
    this.queue = [];
    return {
      value: function () {
        return values;
      }
    };
  },
  push: function (x) {
    return this.queue.push(x.value());
  },
  hasAtLeast: function () {
    return true;
  }
});

Source.isTrigger = function (s) {
  if (s != null ? s._isSource : void 0) {
    return s.sync;
  } else {
    return s != null ? s._isEventStream : void 0;
  }
};

Source.fromObservable = function (s) {
  if (s != null ? s._isSource : void 0) {
    return s;
  } else if (s != null ? s._isProperty : void 0) {
    return new Source(s, false);
  } else {
    return new ConsumingSource(s, true);
  }
};

function Desc(context, method, args) {
  this.context = context;
  this.method = method;
  this.args = args;
}

extend(Desc.prototype, {
  _isDesc: true,
  deps: function () {
    if (!this.cached) {
      this.cached = findDeps([this.context].concat(this.args));
    }
    return this.cached;
  },
  toString: function () {
    return _.toString(this.context) + "." + _.toString(this.method) + "(" + _.map(_.toString, this.args) + ")";
  }
});

var describe = function (context, method) {
  var ref = context || method;
  if (ref && ref._isDesc) {
    return context || method;
  } else {
    for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }

    return new Desc(context, method, args);
  }
};

var withDesc = function (desc, obs) {
  obs.desc = desc;
  return obs;
};

var findDeps = function (x) {
  if (isArray(x)) {
    return _.flatMap(findDeps, x);
  } else if (isObservable(x)) {
    return [x];
  } else if (typeof x !== "undefined" && x !== null ? x._isSource : undefined) {
    return [x.obs];
  } else {
    return [];
  }
};

Bacon.Desc = Desc;
Bacon.Desc.empty = new Bacon.Desc("", "", []);

var withMethodCallSupport = function (wrapped) {
  return function (f) {
    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    if (typeof f === "object" && args.length) {
      var context = f;
      var methodName = args[0];
      f = function () {
        return context[methodName].apply(context, arguments);
      };
      args = args.slice(1);
    }
    return wrapped.apply(undefined, [f].concat(args));
  };
};

var makeFunctionArgs = function (args) {
  args = Array.prototype.slice.call(args);
  return makeFunction_.apply(undefined, args);
};

var partiallyApplied = function (f, applied) {
  return function () {
    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    return f.apply(undefined, applied.concat(args));
  };
};

var toSimpleExtractor = function (args) {
  return function (key) {
    return function (value) {
      if (!(typeof value !== "undefined" && value !== null)) {
        return;
      } else {
        var fieldValue = value[key];
        if (_.isFunction(fieldValue)) {
          return fieldValue.apply(value, args);
        } else {
          return fieldValue;
        }
      }
    };
  };
};

var toFieldExtractor = function (f, args) {
  var parts = f.slice(1).split(".");
  var partFuncs = _.map(toSimpleExtractor(args), parts);
  return function (value) {
    for (var i = 0, f; i < partFuncs.length; i++) {
      f = partFuncs[i];
      value = f(value);
    }
    return value;
  };
};

var isFieldKey = function (f) {
  return typeof f === "string" && f.length > 1 && f.charAt(0) === ".";
};

var makeFunction_ = withMethodCallSupport(function (f) {
  for (var _len4 = arguments.length, args = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
    args[_key4 - 1] = arguments[_key4];
  }

  if (_.isFunction(f)) {
    if (args.length) {
      return partiallyApplied(f, args);
    } else {
      return f;
    }
  } else if (isFieldKey(f)) {
    return toFieldExtractor(f, args);
  } else {
    return _.always(f);
  }
});

var makeFunction = function (f, args) {
  return makeFunction_.apply(undefined, [f].concat(args));
};

var convertArgsToFunction = function (obs, f, args, method) {
  if (typeof f !== "undefined" && f !== null ? f._isProperty : undefined) {
    var sampled = f.sampledBy(obs, function (p, s) {
      return [p, s];
    });
    return method.call(sampled, function (_ref) {
      var p = _ref[0];
      var s = _ref[1];
      return p;
    }).map(function (_ref2) {
      var p = _ref2[0];
      var s = _ref2[1];
      return s;
    });
  } else {
    f = makeFunction(f, args);
    return method.call(obs, f);
  }
};

var toCombinator = function (f) {
  if (_.isFunction(f)) {
    return f;
  } else if (isFieldKey(f)) {
    var key = toFieldKey(f);
    return function (left, right) {
      return left[key](right);
    };
  } else {
    throw new Exception("not a function or a field key: " + f);
  }
};

var toFieldKey = function (f) {
  return f.slice(1);
};

function Some(value) {
  this.value = value;
}

extend(Some.prototype, {
  _isSome: true,
  getOrElse: function () {
    return this.value;
  },
  get: function () {
    return this.value;
  },
  filter: function (f) {
    if (f(this.value)) {
      return new Some(this.value);
    } else {
      return None;
    }
  },
  map: function (f) {
    return new Some(f(this.value));
  },
  forEach: function (f) {
    return f(this.value);
  },
  isDefined: true,
  toArray: function () {
    return [this.value];
  },
  inspect: function () {
    return "Some(" + this.value + ")";
  },
  toString: function () {
    return this.inspect();
  }
});

var None = {
  _isNone: true,
  getOrElse: function (value) {
    return value;
  },
  filter: function () {
    return None;
  },
  map: function () {
    return None;
  },
  forEach: function () {},
  isDefined: false,
  toArray: function () {
    return [];
  },
  inspect: function () {
    return "None";
  },
  toString: function () {
    return this.inspect();
  }
};

var toOption = function (v) {
  if ((typeof v !== "undefined" && v !== null ? v._isSome : undefined) || (typeof v !== "undefined" && v !== null ? v._isNone : undefined)) {
    return v;
  } else {
    return new Some(v);
  }
};

Bacon.noMore = "<no-more>";
Bacon.more = "<more>";

var eventIdCounter = 0;

function Event() {
  this.id = ++eventIdCounter;
}

Event.prototype._isEvent = true;
Event.prototype.isEvent = function () {
  return true;
};
Event.prototype.isEnd = function () {
  return false;
};
Event.prototype.isInitial = function () {
  return false;
};
Event.prototype.isNext = function () {
  return false;
};
Event.prototype.isError = function () {
  return false;
};
Event.prototype.hasValue = function () {
  return false;
};
Event.prototype.filter = function () {
  return true;
};
Event.prototype.inspect = function () {
  return this.toString();
};
Event.prototype.log = function () {
  return this.toString();
};

function Next(valueF, eager) {
  if (!(this instanceof Next)) {
    return new Next(valueF, eager);
  }

  Event.call(this);

  if (!eager && _.isFunction(valueF) || (valueF != null ? valueF._isNext : void 0)) {
    this.valueF = valueF;
    this.valueInternal = void 0;
  } else {
    this.valueF = void 0;
    this.valueInternal = valueF;
  }
}

inherit(Next, Event);

Next.prototype.isNext = function () {
  return true;
};
Next.prototype.hasValue = function () {
  return true;
};
Next.prototype.value = function () {
  var ref;
  if ((ref = this.valueF) != null ? ref._isNext : void 0) {
    this.valueInternal = this.valueF.value();
    this.valueF = void 0;
  } else if (this.valueF) {
    this.valueInternal = this.valueF();
    this.valueF = void 0;
  }
  return this.valueInternal;
};

Next.prototype.fmap = function (f) {
  var event, value;
  if (this.valueInternal) {
    value = this.valueInternal;
    return this.apply(function () {
      return f(value);
    });
  } else {
    event = this;
    return this.apply(function () {
      return f(event.value());
    });
  }
};

Next.prototype.apply = function (value) {
  return new Next(value);
};
Next.prototype.filter = function (f) {
  return f(this.value());
};
Next.prototype.toString = function () {
  return _.toString(this.value());
};
Next.prototype.log = function () {
  return this.value();
};
Next.prototype._isNext = true;

function Initial(valueF, eager) {
  if (!(this instanceof Initial)) {
    return new Initial(valueF, eager);
  }
  Next.call(this, valueF, eager);
}

inherit(Initial, Next);
Initial.prototype._isInitial = true;
Initial.prototype.isInitial = function () {
  return true;
};
Initial.prototype.isNext = function () {
  return false;
};
Initial.prototype.apply = function (value) {
  return new Initial(value);
};
Initial.prototype.toNext = function () {
  return new Next(this);
};

function End() {
  if (!(this instanceof End)) {
    return new End();
  }
  Event.call(this);
}

inherit(End, Event);
End.prototype.isEnd = function () {
  return true;
};
End.prototype.fmap = function () {
  return this;
};
End.prototype.apply = function () {
  return this;
};
End.prototype.toString = function () {
  return "<end>";
};

function Error(error) {
  if (!(this instanceof Error)) {
    return new Error(error);
  }
  this.error = error;
  Event.call(this);
}

inherit(Error, Event);
Error.prototype.isError = function () {
  return true;
};
Error.prototype.fmap = function () {
  return this;
};
Error.prototype.apply = function () {
  return this;
};
Error.prototype.toString = function () {
  return "<error> " + _.toString(this.error);
};

Bacon.Event = Event;
Bacon.Initial = Initial;
Bacon.Next = Next;
Bacon.End = End;
Bacon.Error = Error;

var initialEvent = function (value) {
  return new Initial(value, true);
};
var nextEvent = function (value) {
  return new Next(value, true);
};
var endEvent = function () {
  return new End();
};
var toEvent = function (x) {
  if (x && x._isEvent) {
    return x;
  } else {
    return nextEvent(x);
  }
};

var idCounter = 0;
var registerObs = function () {};

function Observable(desc) {
  this.desc = desc;
  this.id = ++idCounter;
  this.initialDesc = this.desc;
}

extend(Observable.prototype, {
  _isObservable: true,

  subscribe: function (sink) {
    return UpdateBarrier.wrappedSubscribe(this, sink);
  },

  subscribeInternal: function (sink) {
    return this.dispatcher.subscribe(sink);
  },

  onValue: function () {
    var f = makeFunctionArgs(arguments);
    return this.subscribe(function (event) {
      if (event.hasValue()) {
        return f(event.value());
      }
    });
  },

  onValues: function (f) {
    return this.onValue(function (args) {
      return f.apply(undefined, args);
    });
  },

  onError: function () {
    var f = makeFunctionArgs(arguments);
    return this.subscribe(function (event) {
      if (event.isError()) {
        return f(event.error);
      }
    });
  },

  onEnd: function () {
    var f = makeFunctionArgs(arguments);
    return this.subscribe(function (event) {
      if (event.isEnd()) {
        return f();
      }
    });
  },

  name: function (name) {
    this._name = name;
    return this;
  },

  withDescription: function () {
    this.desc = describe.apply(undefined, arguments);
    return this;
  },

  toString: function () {
    if (this._name) {
      return this._name;
    } else {
      return this.desc.toString();
    }
  },

  deps: function () {
    return this.desc.deps();
  },

  internalDeps: function () {
    return this.initialDesc.deps();
  }
});

Observable.prototype.assign = Observable.prototype.onValue;
Observable.prototype.forEach = Observable.prototype.onValue;
Observable.prototype.inspect = Observable.prototype.toString;

Bacon.Observable = Observable;

function CompositeUnsubscribe() {
  var ss = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

  this.unsubscribe = _.bind(this.unsubscribe, this);
  this.unsubscribed = false;
  this.subscriptions = [];
  this.starting = [];
  for (var i = 0, s; i < ss.length; i++) {
    s = ss[i];
    this.add(s);
  }
}

extend(CompositeUnsubscribe.prototype, {
  add: function (subscription) {
    var _this2 = this;

    if (this.unsubscribed) {
      return;
    }
    var ended = false;
    var unsub = nop;
    this.starting.push(subscription);
    var unsubMe = function () {
      if (_this2.unsubscribed) {
        return;
      }
      ended = true;
      _this2.remove(unsub);
      return _.remove(subscription, _this2.starting);
    };
    unsub = subscription(this.unsubscribe, unsubMe);
    if (!(this.unsubscribed || ended)) {
      this.subscriptions.push(unsub);
    } else {
      unsub();
    }
    _.remove(subscription, this.starting);
    return unsub;
  },

  remove: function (unsub) {
    if (this.unsubscribed) {
      return;
    }
    if (_.remove(unsub, this.subscriptions) !== undefined) {
      return unsub();
    }
  },

  unsubscribe: function () {
    if (this.unsubscribed) {
      return;
    }
    this.unsubscribed = true;
    var iterable = this.subscriptions;
    for (var i = 0; i < iterable.length; i++) {
      iterable[i]();
    }
    this.subscriptions = [];
    this.starting = [];
    return [];
  },

  count: function () {
    if (this.unsubscribed) {
      return 0;
    }
    return this.subscriptions.length + this.starting.length;
  },

  empty: function () {
    return this.count() === 0;
  }
});

Bacon.CompositeUnsubscribe = CompositeUnsubscribe;

function Dispatcher(_subscribe, _handleEvent) {
  this._subscribe = _subscribe;
  this._handleEvent = _handleEvent;
  this.subscribe = _.bind(this.subscribe, this);
  this.handleEvent = _.bind(this.handleEvent, this);
  this.pushing = false;
  this.ended = false;
  this.prevError = undefined;
  this.unsubSrc = undefined;
  this.subscriptions = [];
  this.queue = [];
}

Dispatcher.prototype.hasSubscribers = function () {
  return this.subscriptions.length > 0;
};

Dispatcher.prototype.removeSub = function (subscription) {
  this.subscriptions = _.without(subscription, this.subscriptions);
  return this.subscriptions;
};

Dispatcher.prototype.push = function (event) {
  if (event.isEnd()) {
    this.ended = true;
  }
  return UpdateBarrier.inTransaction(event, this, this.pushIt, [event]);
};

Dispatcher.prototype.pushToSubscriptions = function (event) {
  try {
    var tmp = this.subscriptions;
    var len = tmp.length;
    for (var i = 0; i < len; i++) {
      var sub = tmp[i];
      var reply = sub.sink(event);
      if (reply === Bacon.noMore || event.isEnd()) {
        this.removeSub(sub);
      }
    }
    return true;
  } catch (error) {
    this.pushing = false;
    this.queue = [];
    throw error;
  }
};

Dispatcher.prototype.pushIt = function (event) {
  if (!this.pushing) {
    if (event === this.prevError) {
      return;
    }
    if (event.isError()) {
      this.prevError = event;
    }
    this.pushing = true;
    this.pushToSubscriptions(event);
    this.pushing = false;
    while (this.queue.length) {
      event = this.queue.shift();
      this.push(event);
    }
    if (this.hasSubscribers()) {
      return Bacon.more;
    } else {
      this.unsubscribeFromSource();
      return Bacon.noMore;
    }
  } else {
    this.queue.push(event);
    return Bacon.more;
  }
};

Dispatcher.prototype.handleEvent = function (event) {
  if (this._handleEvent) {
    return this._handleEvent(event);
  } else {
    return this.push(event);
  }
};

Dispatcher.prototype.unsubscribeFromSource = function () {
  if (this.unsubSrc) {
    this.unsubSrc();
  }
  this.unsubSrc = undefined;
};

Dispatcher.prototype.subscribe = function (sink) {
  var subscription;
  if (this.ended) {
    sink(endEvent());
    return nop;
  } else {
    assertFunction(sink);
    subscription = {
      sink: sink
    };
    this.subscriptions.push(subscription);
    if (this.subscriptions.length === 1) {
      this.unsubSrc = this._subscribe(this.handleEvent);
      assertFunction(this.unsubSrc);
    }
    return (function (_this) {
      return function () {
        _this.removeSub(subscription);
        if (!_this.hasSubscribers()) {
          return _this.unsubscribeFromSource();
        }
      };
    })(this);
  }
};

Bacon.Dispatcher = Dispatcher;

function EventStream(desc, subscribe, handler) {
  if (!(this instanceof EventStream)) {
    return new EventStream(desc, subscribe, handler);
  }
  if (_.isFunction(desc)) {
    handler = subscribe;
    subscribe = desc;
    desc = Desc.empty;
  }
  Observable.call(this, desc);
  assertFunction(subscribe);
  this.dispatcher = new Dispatcher(subscribe, handler);
  registerObs(this);
}

inherit(EventStream, Observable);
extend(EventStream.prototype, {
  _isEventStream: true,

  toProperty: function (initValue_) {
    var initValue = arguments.length === 0 ? None : toOption(function () {
      return initValue_;
    });
    var disp = this.dispatcher;
    var desc = new Bacon.Desc(this, "toProperty", [initValue_]);
    return new Property(desc, function (sink) {
      var initSent = false;
      var subbed = false;
      var unsub = nop;
      var reply = Bacon.more;
      var sendInit = function () {
        if (!initSent) {
          return initValue.forEach(function (value) {
            initSent = true;
            reply = sink(new Initial(value));
            if (reply === Bacon.noMore) {
              unsub();
              unsub = nop;
              return nop;
            }
          });
        }
      };

      unsub = disp.subscribe(function (event) {
        if (event.hasValue()) {
          if (event.isInitial() && !subbed) {
            initValue = new Some(function () {
              return event.value();
            });
            return Bacon.more;
          } else {
            if (!event.isInitial()) {
              sendInit();
            }
            initSent = true;
            initValue = new Some(event);
            return sink(event);
          }
        } else {
          if (event.isEnd()) {
            reply = sendInit();
          }
          if (reply !== Bacon.noMore) {
            return sink(event);
          }
        }
      });
      subbed = true;
      sendInit();
      return unsub;
    });
  },

  toEventStream: function () {
    return this;
  },

  withHandler: function (handler) {
    return new EventStream(new Bacon.Desc(this, "withHandler", [handler]), this.dispatcher.subscribe, handler);
  }
});

Bacon.EventStream = EventStream;

Bacon.never = function () {
  return new EventStream(describe(Bacon, "never"), function (sink) {
    sink(endEvent());
    return nop;
  });
};

Bacon.when = function () {
  if (arguments.length === 0) {
    return Bacon.never();
  }
  var len = arguments.length;
  var usage = "when: expecting arguments in the form (Observable+,function)+";

  assert(usage, len % 2 === 0);
  var sources = [];
  var pats = [];
  var i = 0;
  var patterns = [];
  while (i < len) {
    patterns[i] = arguments[i];
    patterns[i + 1] = arguments[i + 1];
    var patSources = _.toArray(arguments[i]);
    var f = constantToFunction(arguments[i + 1]);
    var pat = { f: f, ixs: [] };
    var triggerFound = false;
    for (var j = 0, s; j < patSources.length; j++) {
      s = patSources[j];
      var index = _.indexOf(sources, s);
      if (!triggerFound) {
        triggerFound = Source.isTrigger(s);
      }
      if (index < 0) {
        sources.push(s);
        index = sources.length - 1;
      }
      for (var k = 0, ix; k < pat.ixs.length; k++) {
        ix = pat.ixs[k];
        if (ix.index === index) {
          ix.count++;
        }
      }
      pat.ixs.push({ index: index, count: 1 });
    }

    assert("At least one EventStream required", triggerFound || !patSources.length);

    if (patSources.length > 0) {
      pats.push(pat);
    }
    i = i + 2;
  }

  if (!sources.length) {
    return Bacon.never();
  }

  sources = _.map(Source.fromObservable, sources);
  var needsBarrier = _.any(sources, function (s) {
    return s.flatten;
  }) && containsDuplicateDeps(_.map(function (s) {
    return s.obs;
  }, sources));

  var desc = new Bacon.Desc(Bacon, "when", patterns);
  var resultStream = new EventStream(desc, function (sink) {
    var triggers = [];
    var ends = false;
    var match = function (p) {
      for (var i1 = 0, i; i1 < p.ixs.length; i1++) {
        i = p.ixs[i1];
        if (!sources[i.index].hasAtLeast(i.count)) {
          return false;
        }
      }
      return true;
    };
    var cannotSync = function (source) {
      return !source.sync || source.ended;
    };
    var cannotMatch = function (p) {
      for (var i1 = 0, i; i1 < p.ixs.length; i1++) {
        i = p.ixs[i1];
        if (!sources[i.index].mayHave(i.count)) {
          return true;
        }
      }
    };
    var nonFlattened = function (trigger) {
      return !trigger.source.flatten;
    };
    var part = function (source) {
      return function (unsubAll) {
        var flushLater = function () {
          return UpdateBarrier.whenDoneWith(resultStream, flush);
        };
        var flushWhileTriggers = function () {
          if (triggers.length > 0) {
            var reply = Bacon.more;
            var trigger = triggers.pop();
            for (var i1 = 0, p; i1 < pats.length; i1++) {
              p = pats[i1];
              if (match(p)) {
                var events = (function () {
                  var result = [];
                  for (var i2 = 0, i; i2 < p.ixs.length; i2++) {
                    i = p.ixs[i2];
                    result.push(sources[i.index].consume());
                  }
                  return result;
                })();
                reply = sink(trigger.e.apply(function () {
                  var _p;

                  var values = (function () {
                    var result = [];
                    for (var i2 = 0, event; i2 < events.length; i2++) {
                      event = events[i2];
                      result.push(event.value());
                    }
                    return result;
                  })();

                  return (_p = p).f.apply(_p, values);
                }));
                if (triggers.length) {
                  triggers = _.filter(nonFlattened, triggers);
                }
                if (reply === Bacon.noMore) {
                  return reply;
                } else {
                  return flushWhileTriggers();
                }
              }
            }
          } else {
            return Bacon.more;
          }
        };
        var flush = function () {
          var reply = flushWhileTriggers();
          if (ends) {
            if (_.all(sources, cannotSync) || _.all(pats, cannotMatch)) {
              reply = Bacon.noMore;
              sink(endEvent());
            }
          }
          if (reply === Bacon.noMore) {
            unsubAll();
          }

          return reply;
        };
        return source.subscribe(function (e) {
          if (e.isEnd()) {
            ends = true;
            source.markEnded();
            flushLater();
          } else if (e.isError()) {
            var reply = sink(e);
          } else {
            source.push(e);
            if (source.sync) {
              triggers.push({ source: source, e: e });
              if (needsBarrier || UpdateBarrier.hasWaiters()) {
                flushLater();
              } else {
                flush();
              }
            }
          }
          if (reply === Bacon.noMore) {
            unsubAll();
          }
          return reply || Bacon.more;
        });
      };
    };

    return new Bacon.CompositeUnsubscribe((function () {
      var result = [];
      for (var i1 = 0, s; i1 < sources.length; i1++) {
        s = sources[i1];
        result.push(part(s));
      }
      return result;
    })()).unsubscribe;
  });
  return resultStream;
};

var containsDuplicateDeps = function (observables) {
  var state = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  var checkObservable = function (obs) {
    if (_.contains(state, obs)) {
      return true;
    } else {
      var deps = obs.internalDeps();
      if (deps.length) {
        state.push(obs);
        return _.any(deps, checkObservable);
      } else {
        state.push(obs);
        return false;
      }
    }
  };

  return _.any(observables, checkObservable);
};

var constantToFunction = function (f) {
  if (_.isFunction(f)) {
    return f;
  } else {
    return _.always(f);
  }
};

Bacon.groupSimultaneous = function () {
  for (var _len5 = arguments.length, streams = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
    streams[_key5] = arguments[_key5];
  }

  if (streams.length === 1 && isArray(streams[0])) {
    streams = streams[0];
  }
  var sources = (function () {
    var result = [];
    for (var i = 0, s; i < streams.length; i++) {
      s = streams[i];
      result.push(new BufferingSource(s));
    }
    return result;
  })();
  return withDesc(new Bacon.Desc(Bacon, "groupSimultaneous", streams), Bacon.when(sources, function () {
    for (var _len6 = arguments.length, xs = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
      xs[_key6] = arguments[_key6];
    }

    return xs;
  }));
};

function PropertyDispatcher(property, subscribe, handleEvent) {
  Dispatcher.call(this, subscribe, handleEvent);
  this.property = property;
  this.subscribe = _.bind(this.subscribe, this);
  this.current = None;
  this.currentValueRootId = undefined;
  this.propertyEnded = false;
}

inherit(PropertyDispatcher, Dispatcher);
extend(PropertyDispatcher.prototype, {
  push: function (event) {
    if (event.isEnd()) {
      this.propertyEnded = true;
    }
    if (event.hasValue()) {
      this.current = new Some(event);
      this.currentValueRootId = UpdateBarrier.currentEventId();
    }
    return Dispatcher.prototype.push.call(this, event);
  },

  maybeSubSource: function (sink, reply) {
    if (reply === Bacon.noMore) {
      return nop;
    } else if (this.propertyEnded) {
      sink(endEvent());
      return nop;
    } else {
      return Dispatcher.prototype.subscribe.call(this, sink);
    }
  },

  subscribe: function (sink) {
    var _this3 = this;

    var initSent = false;

    var reply = Bacon.more;

    if (this.current.isDefined && (this.hasSubscribers() || this.propertyEnded)) {
      var dispatchingId = UpdateBarrier.currentEventId();
      var valId = this.currentValueRootId;
      if (!this.propertyEnded && valId && dispatchingId && dispatchingId !== valId) {
        UpdateBarrier.whenDoneWith(this.property, function () {
          if (_this3.currentValueRootId === valId) {
            return sink(initialEvent(_this3.current.get().value()));
          }
        });

        return this.maybeSubSource(sink, reply);
      } else {
        UpdateBarrier.inTransaction(undefined, this, function () {
          reply = sink(initialEvent(this.current.get().value()));
          return reply;
        }, []);
        return this.maybeSubSource(sink, reply);
      }
    } else {
      return this.maybeSubSource(sink, reply);
    }
  }
});

function Property(desc, subscribe, handler) {
  Observable.call(this, desc);
  assertFunction(subscribe);
  this.dispatcher = new PropertyDispatcher(this, subscribe, handler);
  registerObs(this);
}

inherit(Property, Observable);
extend(Property.prototype, {
  _isProperty: true,

  changes: function () {
    var _this4 = this;

    return new EventStream(new Bacon.Desc(this, "changes", []), function (sink) {
      return _this4.dispatcher.subscribe(function (event) {
        if (!event.isInitial()) {
          return sink(event);
        }
      });
    });
  },

  withHandler: function (handler) {
    return new Property(new Bacon.Desc(this, "withHandler", [handler]), this.dispatcher.subscribe, handler);
  },

  toProperty: function () {
    assertNoArguments(arguments);
    return this;
  },

  toEventStream: function () {
    var _this5 = this;

    return new EventStream(new Bacon.Desc(this, "toEventStream", []), function (sink) {
      return _this5.dispatcher.subscribe(function (event) {
        if (event.isInitial()) {
          event = event.toNext();
        }
        return sink(event);
      });
    });
  }
});

Bacon.Property = Property;

Bacon.constant = function (value) {
  return new Property(new Bacon.Desc(Bacon, "constant", [value]), function (sink) {
    sink(initialEvent(value));
    sink(endEvent());
    return nop;
  });
};

Bacon.fromBinder = function (binder) {
  var eventTransformer = arguments.length <= 1 || arguments[1] === undefined ? _.id : arguments[1];

  var desc = new Bacon.Desc(Bacon, "fromBinder", [binder, eventTransformer]);
  return new EventStream(desc, function (sink) {
    var unbound = false;
    var shouldUnbind = false;
    var unbind = function () {
      if (!unbound) {
        if (typeof unbinder !== "undefined" && unbinder !== null) {
          unbinder();
          return unbound = true;
        } else {
          return shouldUnbind = true;
        }
      }
    };
    var unbinder = binder(function () {
      var ref;

      for (var _len7 = arguments.length, args = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
        args[_key7] = arguments[_key7];
      }

      var value = eventTransformer.apply(this, args);
      if (!(isArray(value) && ((ref = _.last(value)) != null ? ref._isEvent : undefined))) {
        value = [value];
      }
      var reply = Bacon.more;
      for (var i = 0, event; i < value.length; i++) {
        event = value[i];
        reply = sink(event = toEvent(event));
        if (reply === Bacon.noMore || event.isEnd()) {
          unbind();
          return reply;
        }
      }
      return reply;
    });
    if (shouldUnbind) {
      unbind();
    }
    return unbind;
  });
};

Bacon.Observable.prototype.map = function (p) {
  for (var _len8 = arguments.length, args = Array(_len8 > 1 ? _len8 - 1 : 0), _key8 = 1; _key8 < _len8; _key8++) {
    args[_key8 - 1] = arguments[_key8];
  }

  return convertArgsToFunction(this, p, args, function (f) {
    return withDesc(new Bacon.Desc(this, "map", [f]), this.withHandler(function (event) {
      return this.push(event.fmap(f));
    }));
  });
};

var argumentsToObservables = function (args) {
  if (isArray(args[0])) {
    return args[0];
  } else {
    return Array.prototype.slice.call(args);
  }
};

var argumentsToObservablesAndFunction = function (args) {
  if (_.isFunction(args[0])) {
    return [argumentsToObservables(Array.prototype.slice.call(args, 1)), args[0]];
  } else {
    return [argumentsToObservables(Array.prototype.slice.call(args, 0, args.length - 1)), _.last(args)];
  }
};

Bacon.combineAsArray = function () {
  var streams = argumentsToObservables(arguments);
  if (streams.length) {
    var sources = [];
    for (var i = 0; i < streams.length; i++) {
      var stream = isObservable(streams[i]) ? streams[i] : Bacon.constant(streams[i]);
      sources.push(new Source(stream, true));
    }
    return withDesc(new Bacon.Desc(Bacon, "combineAsArray", streams), Bacon.when(sources, function () {
      for (var _len9 = arguments.length, xs = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
        xs[_key9] = arguments[_key9];
      }

      return xs;
    }).toProperty());
  } else {
    return Bacon.constant([]);
  }
};

Bacon.onValues = function () {
  return Bacon.combineAsArray(Array.prototype.slice.call(arguments, 0, arguments.length - 1)).onValues(arguments[arguments.length - 1]);
};

Bacon.combineWith = function () {
  var _argumentsToObservablesAndFunction = argumentsToObservablesAndFunction(arguments);

  var streams = _argumentsToObservablesAndFunction[0];
  var f = _argumentsToObservablesAndFunction[1];

  var desc = new Bacon.Desc(Bacon, "combineWith", [f].concat(streams));
  return withDesc(desc, Bacon.combineAsArray(streams).map(function (values) {
    return f.apply(undefined, values);
  }));
};

Bacon.Observable.prototype.combine = function (other, f) {
  var combinator = toCombinator(f);
  var desc = new Bacon.Desc(this, "combine", [other, f]);
  return withDesc(desc, Bacon.combineAsArray(this, other).map(function (values) {
    return combinator(values[0], values[1]);
  }));
};

Bacon.Observable.prototype.withStateMachine = function (initState, f) {
  var state = initState;
  var desc = new Bacon.Desc(this, "withStateMachine", [initState, f]);
  return withDesc(desc, this.withHandler(function (event) {
    var fromF = f(state, event);
    var newState = fromF[0];
    var outputs = fromF[1];

    state = newState;
    var reply = Bacon.more;
    for (var i = 0, output; i < outputs.length; i++) {
      output = outputs[i];
      reply = this.push(output);
      if (reply === Bacon.noMore) {
        return reply;
      }
    }
    return reply;
  }));
};

var equals = function (a, b) {
  return a === b;
};

var isNone = function (object) {
  return typeof object !== "undefined" && object !== null ? object._isNone : false;
};

Bacon.Observable.prototype.skipDuplicates = function () {
  var isEqual = arguments.length <= 0 || arguments[0] === undefined ? equals : arguments[0];

  var desc = new Bacon.Desc(this, "skipDuplicates", []);
  return withDesc(desc, this.withStateMachine(None, function (prev, event) {
    if (!event.hasValue()) {
      return [prev, [event]];
    } else if (event.isInitial() || isNone(prev) || !isEqual(prev.get(), event.value())) {
      return [new Some(event.value()), [event]];
    } else {
      return [prev, []];
    }
  }));
};

Bacon.Observable.prototype.awaiting = function (other) {
  var desc = new Bacon.Desc(this, "awaiting", [other]);
  return withDesc(desc, Bacon.groupSimultaneous(this, other).map(function (values) {
    return values[1].length === 0;
  }).toProperty(false).skipDuplicates());
};

Bacon.Observable.prototype.not = function () {
  return withDesc(new Bacon.Desc(this, "not", []), this.map(function (x) {
    return !x;
  }));
};

Bacon.Property.prototype.and = function (other) {
  return withDesc(new Bacon.Desc(this, "and", [other]), this.combine(other, function (x, y) {
    return x && y;
  }));
};

Bacon.Property.prototype.or = function (other) {
  return withDesc(new Bacon.Desc(this, "or", [other]), this.combine(other, function (x, y) {
    return x || y;
  }));
};

Bacon.scheduler = {
  setTimeout: function (f, d) {
    return setTimeout(f, d);
  },
  setInterval: function (f, i) {
    return setInterval(f, i);
  },
  clearInterval: function (id) {
    return clearInterval(id);
  },
  clearTimeout: function (id) {
    return clearTimeout(id);
  },
  now: function () {
    return new Date().getTime();
  }
};

Bacon.EventStream.prototype.bufferWithTime = function (delay) {
  return withDesc(new Bacon.Desc(this, "bufferWithTime", [delay]), this.bufferWithTimeOrCount(delay, Number.MAX_VALUE));
};

Bacon.EventStream.prototype.bufferWithCount = function (count) {
  return withDesc(new Bacon.Desc(this, "bufferWithCount", [count]), this.bufferWithTimeOrCount(undefined, count));
};

Bacon.EventStream.prototype.bufferWithTimeOrCount = function (delay, count) {
  var flushOrSchedule = function (buffer) {
    if (buffer.values.length === count) {
      return buffer.flush();
    } else if (delay !== undefined) {
      return buffer.schedule();
    }
  };
  var desc = new Bacon.Desc(this, "bufferWithTimeOrCount", [delay, count]);
  return withDesc(desc, this.buffer(delay, flushOrSchedule, flushOrSchedule));
};

Bacon.EventStream.prototype.buffer = function (delay) {
  var onInput = arguments.length <= 1 || arguments[1] === undefined ? nop : arguments[1];
  var onFlush = arguments.length <= 2 || arguments[2] === undefined ? nop : arguments[2];

  var buffer = {
    scheduled: null,
    end: undefined,
    values: [],
    flush: function () {
      if (this.scheduled) {
        Bacon.scheduler.clearTimeout(this.scheduled);
        this.scheduled = null;
      }
      if (this.values.length > 0) {
        var valuesToPush = this.values;
        this.values = [];
        var reply = this.push(nextEvent(valuesToPush));
        if (this.end != null) {
          return this.push(this.end);
        } else if (reply !== Bacon.noMore) {
          return onFlush(this);
        }
      } else {
        if (this.end != null) {
          return this.push(this.end);
        }
      }
    },
    schedule: function () {
      var _this6 = this;

      if (!this.scheduled) {
        return this.scheduled = delay(function () {
          return _this6.flush();
        });
      }
    }
  };
  var reply = Bacon.more;
  if (!_.isFunction(delay)) {
    var delayMs = delay;
    delay = function (f) {
      return Bacon.scheduler.setTimeout(f, delayMs);
    };
  }
  return withDesc(new Bacon.Desc(this, "buffer", []), this.withHandler(function (event) {
    var _this7 = this;

    buffer.push = function (event) {
      return _this7.push(event);
    };
    if (event.isError()) {
      reply = this.push(event);
    } else if (event.isEnd()) {
      buffer.end = event;
      if (!buffer.scheduled) {
        buffer.flush();
      }
    } else {
      buffer.values.push(event.value());

      onInput(buffer);
    }
    return reply;
  }));
};

Bacon.Observable.prototype.filter = function (f) {
  assertObservableIsProperty(f);

  for (var _len10 = arguments.length, args = Array(_len10 > 1 ? _len10 - 1 : 0), _key10 = 1; _key10 < _len10; _key10++) {
    args[_key10 - 1] = arguments[_key10];
  }

  return convertArgsToFunction(this, f, args, function (f) {
    return withDesc(new Bacon.Desc(this, "filter", [f]), this.withHandler(function (event) {
      if (event.filter(f)) {
        return this.push(event);
      } else {
        return Bacon.more;
      }
    }));
  });
};

Bacon.once = function (value) {
  return new EventStream(new Desc(Bacon, "once", [value]), function (sink) {
    sink(toEvent(value));
    sink(endEvent());
    return nop;
  });
};

Bacon.EventStream.prototype.concat = function (right) {
  var left = this;
  return new EventStream(new Bacon.Desc(left, "concat", [right]), function (sink) {
    var unsubRight = nop;
    var unsubLeft = left.dispatcher.subscribe(function (e) {
      if (e.isEnd()) {
        unsubRight = right.dispatcher.subscribe(sink);
        return unsubRight;
      } else {
        return sink(e);
      }
    });
    return function () {
      return unsubLeft(), unsubRight();
    };
  });
};

Bacon.Observable.prototype.flatMap = function () {
  return flatMap_(this, makeSpawner(arguments));
};

Bacon.Observable.prototype.flatMapFirst = function () {
  return flatMap_(this, makeSpawner(arguments), true);
};

var makeSpawner = function (args) {
  if (args.length === 1 && isObservable(args[0])) {
    return _.always(args[0]);
  } else {
    return makeFunctionArgs(args);
  }
};

var makeObservable = function (x) {
  if (isObservable(x)) {
    return x;
  } else {
    return Bacon.once(x);
  }
};

var flatMap_ = function (root, f, firstOnly, limit) {
  var rootDep = [root];
  var childDeps = [];
  var desc = new Bacon.Desc(root, "flatMap" + (firstOnly ? "First" : ""), [f]);
  var result = new EventStream(desc, function (sink) {
    var composite = new CompositeUnsubscribe();
    var queue = [];
    var spawn = function (event) {
      var child = makeObservable(f(event.value()));
      childDeps.push(child);
      return composite.add(function (unsubAll, unsubMe) {
        return child.dispatcher.subscribe(function (event) {
          if (event.isEnd()) {
            _.remove(child, childDeps);
            checkQueue();
            checkEnd(unsubMe);
            return Bacon.noMore;
          } else {
            if (typeof event !== "undefined" && event !== null ? event._isInitial : undefined) {
              event = event.toNext();
            }
            var reply = sink(event);
            if (reply === Bacon.noMore) {
              unsubAll();
            }
            return reply;
          }
        });
      });
    };
    var checkQueue = function () {
      var event = queue.shift();
      if (event) {
        return spawn(event);
      }
    };
    var checkEnd = function (unsub) {
      unsub();
      if (composite.empty()) {
        return sink(endEvent());
      }
    };
    composite.add(function (__, unsubRoot) {
      return root.dispatcher.subscribe(function (event) {
        if (event.isEnd()) {
          return checkEnd(unsubRoot);
        } else if (event.isError()) {
          return sink(event);
        } else if (firstOnly && composite.count() > 1) {
          return Bacon.more;
        } else {
          if (composite.unsubscribed) {
            return Bacon.noMore;
          }
          if (limit && composite.count() > limit) {
            return queue.push(event);
          } else {
            return spawn(event);
          }
        }
      });
    });
    return composite.unsubscribe;
  });
  result.internalDeps = function () {
    if (childDeps.length) {
      return rootDep.concat(childDeps);
    } else {
      return rootDep;
    }
  };
  return result;
};

Bacon.Observable.prototype.flatMapWithConcurrencyLimit = function (limit) {
  for (var _len11 = arguments.length, args = Array(_len11 > 1 ? _len11 - 1 : 0), _key11 = 1; _key11 < _len11; _key11++) {
    args[_key11 - 1] = arguments[_key11];
  }

  var desc = new Bacon.Desc(this, "flatMapWithConcurrencyLimit", [limit].concat(args));
  return withDesc(desc, flatMap_(this, makeSpawner(args), false, limit));
};

Bacon.Observable.prototype.flatMapConcat = function () {
  var desc = new Bacon.Desc(this, "flatMapConcat", Array.prototype.slice.call(arguments, 0));
  return withDesc(desc, this.flatMapWithConcurrencyLimit.apply(this, [1].concat(_slice.call(arguments))));
};

Bacon.later = function (delay, value) {
  return withDesc(new Bacon.Desc(Bacon, "later", [delay, value]), Bacon.fromBinder(function (sink) {
    var sender = function () {
      return sink([value, endEvent()]);
    };
    var id = Bacon.scheduler.setTimeout(sender, delay);
    return function () {
      return Bacon.scheduler.clearTimeout(id);
    };
  }));
};

Bacon.Observable.prototype.bufferingThrottle = function (minimumInterval) {
  var desc = new Bacon.Desc(this, "bufferingThrottle", [minimumInterval]);
  return withDesc(desc, this.flatMapConcat(function (x) {
    return Bacon.once(x).concat(Bacon.later(minimumInterval).filter(false));
  }));
};

Bacon.Property.prototype.bufferingThrottle = function () {
  return Bacon.Observable.prototype.bufferingThrottle.apply(this, arguments).toProperty();
};

function Bus() {
  if (!(this instanceof Bus)) {
    return new Bus();
  }

  this.unsubAll = _.bind(this.unsubAll, this);
  this.subscribeAll = _.bind(this.subscribeAll, this);
  this.guardedSink = _.bind(this.guardedSink, this);

  this.sink = undefined;
  this.subscriptions = [];
  this.ended = false;
  EventStream.call(this, new Bacon.Desc(Bacon, "Bus", []), this.subscribeAll);
}

inherit(Bus, EventStream);
extend(Bus.prototype, {
  unsubAll: function () {
    var iterable = this.subscriptions;
    for (var i = 0, sub; i < iterable.length; i++) {
      sub = iterable[i];
      if (typeof sub.unsub === "function") {
        sub.unsub();
      }
    }
  },

  subscribeAll: function (newSink) {
    if (this.ended) {
      newSink(endEvent());
    } else {
      this.sink = newSink;
      var iterable = cloneArray(this.subscriptions);
      for (var i = 0, subscription; i < iterable.length; i++) {
        subscription = iterable[i];
        this.subscribeInput(subscription);
      }
    }
    return this.unsubAll;
  },

  guardedSink: function (input) {
    var _this8 = this;

    return function (event) {
      if (event.isEnd()) {
        _this8.unsubscribeInput(input);
        return Bacon.noMore;
      } else {
        return _this8.sink(event);
      }
    };
  },

  subscribeInput: function (subscription) {
    subscription.unsub = subscription.input.dispatcher.subscribe(this.guardedSink(subscription.input));
    return subscription.unsub;
  },

  unsubscribeInput: function (input) {
    var iterable = this.subscriptions;
    for (var i = 0, sub; i < iterable.length; i++) {
      sub = iterable[i];
      if (sub.input === input) {
        if (typeof sub.unsub === "function") {
          sub.unsub();
        }
        this.subscriptions.splice(i, 1);
        return;
      }
    }
  },

  plug: function (input) {
    var _this9 = this;

    assertObservable(input);
    if (this.ended) {
      return;
    }
    var sub = { input: input };
    this.subscriptions.push(sub);
    if (typeof this.sink !== "undefined") {
      this.subscribeInput(sub);
    }
    return function () {
      return _this9.unsubscribeInput(input);
    };
  },

  end: function () {
    this.ended = true;
    this.unsubAll();
    if (typeof this.sink === "function") {
      return this.sink(endEvent());
    }
  },

  push: function (value) {
    if (!this.ended && typeof this.sink === "function") {
      return this.sink(nextEvent(value));
    }
  },

  error: function (error) {
    if (typeof this.sink === "function") {
      return this.sink(new Error(error));
    }
  }
});

Bacon.Bus = Bus;

var liftCallback = function (desc, wrapped) {
  return withMethodCallSupport(function (f) {
    var stream = partiallyApplied(wrapped, [function (values, callback) {
      return f.apply(undefined, values.concat([callback]));
    }]);

    for (var _len12 = arguments.length, args = Array(_len12 > 1 ? _len12 - 1 : 0), _key12 = 1; _key12 < _len12; _key12++) {
      args[_key12 - 1] = arguments[_key12];
    }

    return withDesc(new Bacon.Desc(Bacon, desc, [f].concat(args)), Bacon.combineAsArray(args).flatMap(stream));
  });
};

Bacon.fromCallback = liftCallback("fromCallback", function (f) {
  for (var _len13 = arguments.length, args = Array(_len13 > 1 ? _len13 - 1 : 0), _key13 = 1; _key13 < _len13; _key13++) {
    args[_key13 - 1] = arguments[_key13];
  }

  return Bacon.fromBinder(function (handler) {
    makeFunction(f, args)(handler);
    return nop;
  }, function (value) {
    return [value, endEvent()];
  });
});

Bacon.fromNodeCallback = liftCallback("fromNodeCallback", function (f) {
  for (var _len14 = arguments.length, args = Array(_len14 > 1 ? _len14 - 1 : 0), _key14 = 1; _key14 < _len14; _key14++) {
    args[_key14 - 1] = arguments[_key14];
  }

  return Bacon.fromBinder(function (handler) {
    makeFunction(f, args)(handler);
    return nop;
  }, function (error, value) {
    if (error) {
      return [new Error(error), endEvent()];
    }
    return [value, endEvent()];
  });
});

Bacon.combineTemplate = function (template) {
  function current(ctxStack) {
    return ctxStack[ctxStack.length - 1];
  }
  function setValue(ctxStack, key, value) {
    current(ctxStack)[key] = value;
    return value;
  }
  function applyStreamValue(key, index) {
    return function (ctxStack, values) {
      return setValue(ctxStack, key, values[index]);
    };
  }
  function constantValue(key, value) {
    return function (ctxStack) {
      return setValue(ctxStack, key, value);
    };
  }

  function mkContext(template) {
    return isArray(template) ? [] : {};
  }

  function pushContext(key, value) {
    return function (ctxStack) {
      var newContext = mkContext(value);
      setValue(ctxStack, key, newContext);
      return ctxStack.push(newContext);
    };
  }

  function compile(key, value) {
    if (isObservable(value)) {
      streams.push(value);
      return funcs.push(applyStreamValue(key, streams.length - 1));
    } else if (value && (value.constructor == Object || value.constructor == Array)) {
      var popContext = function (ctxStack) {
        return ctxStack.pop();
      };
      funcs.push(pushContext(key, value));
      compileTemplate(value);
      return funcs.push(popContext);
    } else {
      return funcs.push(constantValue(key, value));
    }
  }

  function combinator(values) {
    var rootContext = mkContext(template);
    var ctxStack = [rootContext];
    for (var i = 0, f; i < funcs.length; i++) {
      f = funcs[i];
      f(ctxStack, values);
    }
    return rootContext;
  }

  function compileTemplate(template) {
    return _.each(template, compile);
  }

  var funcs = [];
  var streams = [];

  compileTemplate(template);

  return withDesc(new Bacon.Desc(Bacon, "combineTemplate", [template]), Bacon.combineAsArray(streams).map(combinator));
};

var addPropertyInitValueToStream = function (property, stream) {
  var justInitValue = new EventStream(describe(property, "justInitValue"), function (sink) {
    var value = undefined;
    var unsub = property.dispatcher.subscribe(function (event) {
      if (!event.isEnd()) {
        value = event;
      }
      return Bacon.noMore;
    });
    UpdateBarrier.whenDoneWith(justInitValue, function () {
      if (typeof value !== "undefined" && value !== null) {
        sink(value);
      }
      return sink(endEvent());
    });
    return unsub;
  });
  return justInitValue.concat(stream).toProperty();
};

Bacon.Observable.prototype.mapEnd = function () {
  var f = makeFunctionArgs(arguments);
  return withDesc(new Bacon.Desc(this, "mapEnd", [f]), this.withHandler(function (event) {
    if (event.isEnd()) {
      this.push(nextEvent(f(event)));
      this.push(endEvent());
      return Bacon.noMore;
    } else {
      return this.push(event);
    }
  }));
};

Bacon.Observable.prototype.skipErrors = function () {
  return withDesc(new Bacon.Desc(this, "skipErrors", []), this.withHandler(function (event) {
    if (event.isError()) {
      return Bacon.more;
    } else {
      return this.push(event);
    }
  }));
};

Bacon.EventStream.prototype.takeUntil = function (stopper) {
  var endMarker = {};
  return withDesc(new Bacon.Desc(this, "takeUntil", [stopper]), Bacon.groupSimultaneous(this.mapEnd(endMarker), stopper.skipErrors()).withHandler(function (event) {
    if (!event.hasValue()) {
      return this.push(event);
    } else {
      var _event$value = event.value();

      var data = _event$value[0];
      var stopper = _event$value[1];

      if (stopper.length) {
        return this.push(endEvent());
      } else {
        var reply = Bacon.more;
        for (var i = 0, value; i < data.length; i++) {
          value = data[i];
          if (value === endMarker) {
            reply = this.push(endEvent());
          } else {
            reply = this.push(nextEvent(value));
          }
        }
        return reply;
      }
    }
  }));
};

Bacon.Property.prototype.takeUntil = function (stopper) {
  var changes = this.changes().takeUntil(stopper);
  return withDesc(new Bacon.Desc(this, "takeUntil", [stopper]), addPropertyInitValueToStream(this, changes));
};

Bacon.Observable.prototype.flatMapLatest = function () {
  var f = makeSpawner(arguments);
  var stream = this.toEventStream();
  return withDesc(new Bacon.Desc(this, "flatMapLatest", [f]), stream.flatMap(function (value) {
    return makeObservable(f(value)).takeUntil(stream);
  }));
};

Bacon.Property.prototype.delayChanges = function (desc, f) {
  return withDesc(desc, addPropertyInitValueToStream(this, f(this.changes())));
};

Bacon.EventStream.prototype.delay = function (delay) {
  return withDesc(new Bacon.Desc(this, "delay", [delay]), this.flatMap(function (value) {
    return Bacon.later(delay, value);
  }));
};

Bacon.Property.prototype.delay = function (delay) {
  return this.delayChanges(new Bacon.Desc(this, "delay", [delay]), function (changes) {
    return changes.delay(delay);
  });
};

Bacon.EventStream.prototype.debounce = function (delay) {
  return withDesc(new Bacon.Desc(this, "debounce", [delay]), this.flatMapLatest(function (value) {
    return Bacon.later(delay, value);
  }));
};

Bacon.Property.prototype.debounce = function (delay) {
  return this.delayChanges(new Bacon.Desc(this, "debounce", [delay]), function (changes) {
    return changes.debounce(delay);
  });
};

Bacon.EventStream.prototype.debounceImmediate = function (delay) {
  return withDesc(new Bacon.Desc(this, "debounceImmediate", [delay]), this.flatMapFirst(function (value) {
    return Bacon.once(value).concat(Bacon.later(delay).filter(false));
  }));
};

Bacon.Property.prototype.debounceImmediate = function (delay) {
  return this.delayChanges(new Bacon.Desc(this, "debounceImmediate", [delay]), function (changes) {
    return changes.debounceImmediate(delay);
  });
};

Bacon.Observable.prototype.decode = function (cases) {
  return withDesc(new Bacon.Desc(this, "decode", [cases]), this.combine(Bacon.combineTemplate(cases), function (key, values) {
    return values[key];
  }));
};

Bacon.Observable.prototype.scan = function (seed, f) {
  var _this10 = this;

  var resultProperty;
  f = toCombinator(f);
  var acc = toOption(seed);
  var initHandled = false;
  var subscribe = function (sink) {
    var initSent = false;
    var unsub = nop;
    var reply = Bacon.more;
    var sendInit = function () {
      if (!initSent) {
        return acc.forEach(function (value) {
          initSent = initHandled = true;
          reply = sink(new Initial(function () {
            return value;
          }));
          if (reply === Bacon.noMore) {
            unsub();
            unsub = nop;
            return unsub;
          }
        });
      }
    };
    unsub = _this10.dispatcher.subscribe(function (event) {
      if (event.hasValue()) {
        if (initHandled && event.isInitial()) {
          return Bacon.more;
        } else {
            if (!event.isInitial()) {
              sendInit();
            }
            initSent = initHandled = true;
            var prev = acc.getOrElse(undefined);
            var next = f(prev, event.value());

            acc = new Some(next);
            return sink(event.apply(function () {
              return next;
            }));
          }
      } else {
        if (event.isEnd()) {
          reply = sendInit();
        }
        if (reply !== Bacon.noMore) {
          return sink(event);
        }
      }
    });
    UpdateBarrier.whenDoneWith(resultProperty, sendInit);
    return unsub;
  };
  resultProperty = new Property(new Bacon.Desc(this, "scan", [seed, f]), subscribe);
  return resultProperty;
};

Bacon.Observable.prototype.diff = function (start, f) {
  f = toCombinator(f);
  return withDesc(new Bacon.Desc(this, "diff", [start, f]), this.scan([start], function (prevTuple, next) {
    return [next, f(prevTuple[0], next)];
  }).filter(function (tuple) {
    return tuple.length === 2;
  }).map(function (tuple) {
    return tuple[1];
  }));
};

Bacon.Observable.prototype.doAction = function () {
  var f = makeFunctionArgs(arguments);
  return withDesc(new Bacon.Desc(this, "doAction", [f]), this.withHandler(function (event) {
    if (event.hasValue()) {
      f(event.value());
    }
    return this.push(event);
  }));
};

Bacon.Observable.prototype.doEnd = function () {
  var f = makeFunctionArgs(arguments);
  return withDesc(new Bacon.Desc(this, "doEnd", [f]), this.withHandler(function (event) {
    if (event.isEnd()) {
      f();
    }
    return this.push(event);
  }));
};

Bacon.Observable.prototype.doError = function () {
  var f = makeFunctionArgs(arguments);
  return withDesc(new Bacon.Desc(this, "doError", [f]), this.withHandler(function (event) {
    if (event.isError()) {
      f(event.error);
    }
    return this.push(event);
  }));
};

Bacon.Observable.prototype.doLog = function () {
  for (var _len15 = arguments.length, args = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
    args[_key15] = arguments[_key15];
  }

  return withDesc(new Bacon.Desc(this, "doLog", args), this.withHandler(function (event) {
    if (typeof console !== "undefined" && console !== null && typeof console.log === "function") {
      console.log.apply(console, args.concat([event.log()]));
    }
    return this.push(event);
  }));
};

Bacon.Observable.prototype.endOnError = function (f) {
  if (!(typeof f !== "undefined" && f !== null)) {
    f = true;
  }

  for (var _len16 = arguments.length, args = Array(_len16 > 1 ? _len16 - 1 : 0), _key16 = 1; _key16 < _len16; _key16++) {
    args[_key16 - 1] = arguments[_key16];
  }

  return convertArgsToFunction(this, f, args, function (f) {
    return withDesc(new Bacon.Desc(this, "endOnError", []), this.withHandler(function (event) {
      if (event.isError() && f(event.error)) {
        this.push(event);
        return this.push(endEvent());
      } else {
        return this.push(event);
      }
    }));
  });
};

Observable.prototype.errors = function () {
  return withDesc(new Bacon.Desc(this, "errors", []), this.filter(function () {
    return false;
  }));
};

Bacon.Observable.prototype.take = function (count) {
  if (count <= 0) {
    return Bacon.never();
  }
  return withDesc(new Bacon.Desc(this, "take", [count]), this.withHandler(function (event) {
    if (!event.hasValue()) {
      return this.push(event);
    } else {
      count--;
      if (count > 0) {
        return this.push(event);
      } else {
        if (count === 0) {
          this.push(event);
        }
        this.push(endEvent());
        return Bacon.noMore;
      }
    }
  }));
};

Bacon.Observable.prototype.first = function () {
  return withDesc(new Bacon.Desc(this, "first", []), this.take(1));
};

Bacon.Observable.prototype.mapError = function () {
  var f = makeFunctionArgs(arguments);
  return withDesc(new Bacon.Desc(this, "mapError", [f]), this.withHandler(function (event) {
    if (event.isError()) {
      return this.push(nextEvent(f(event.error)));
    } else {
      return this.push(event);
    }
  }));
};

Bacon.Observable.prototype.flatMapError = function (fn) {
  var desc = new Bacon.Desc(this, "flatMapError", [fn]);
  return withDesc(desc, this.mapError(function (err) {
    return new Error(err);
  }).flatMap(function (x) {
    if (x instanceof Error) {
      return fn(x.error);
    } else {
      return Bacon.once(x);
    }
  }));
};

Bacon.EventStream.prototype.sampledBy = function (sampler, combinator) {
  return withDesc(new Bacon.Desc(this, "sampledBy", [sampler, combinator]), this.toProperty().sampledBy(sampler, combinator));
};

Bacon.Property.prototype.sampledBy = function (sampler, combinator) {
  var lazy = false;
  if (typeof combinator !== "undefined" && combinator !== null) {
    combinator = toCombinator(combinator);
  } else {
    lazy = true;
    combinator = function (f) {
      return f.value();
    };
  }
  var thisSource = new Source(this, false, lazy);
  var samplerSource = new Source(sampler, true, lazy);
  var stream = Bacon.when([thisSource, samplerSource], combinator);
  var result = sampler._isProperty ? stream.toProperty() : stream;
  return withDesc(new Bacon.Desc(this, "sampledBy", [sampler, combinator]), result);
};

Bacon.Property.prototype.sample = function (interval) {
  return withDesc(new Bacon.Desc(this, "sample", [interval]), this.sampledBy(Bacon.interval(interval, {})));
};

Bacon.Observable.prototype.map = function (p) {
  if (p && p._isProperty) {
    return p.sampledBy(this, former);
  } else {
    for (var _len17 = arguments.length, args = Array(_len17 > 1 ? _len17 - 1 : 0), _key17 = 1; _key17 < _len17; _key17++) {
      args[_key17 - 1] = arguments[_key17];
    }

    return convertArgsToFunction(this, p, args, function (f) {
      return withDesc(new Bacon.Desc(this, "map", [f]), this.withHandler(function (event) {
        return this.push(event.fmap(f));
      }));
    });
  }
};

Bacon.Observable.prototype.fold = function (seed, f) {
  return withDesc(new Bacon.Desc(this, "fold", [seed, f]), this.scan(seed, f).sampledBy(this.filter(false).mapEnd().toProperty()));
};

Observable.prototype.reduce = Observable.prototype.fold;

var eventMethods = [["addEventListener", "removeEventListener"], ["addListener", "removeListener"], ["on", "off"], ["bind", "unbind"]];

var findHandlerMethods = function (target) {
  var pair;
  for (var i = 0; i < eventMethods.length; i++) {
    pair = eventMethods[i];
    var methodPair = [target[pair[0]], target[pair[1]]];
    if (methodPair[0] && methodPair[1]) {
      return methodPair;
    }
  }
  for (var j = 0; j < eventMethods.length; j++) {
    pair = eventMethods[j];
    var addListener = target[pair[0]];
    if (addListener) {
      return [addListener, function () {}];
    }
  }
  throw new Error("No suitable event methods in " + target);
};

Bacon.fromEventTarget = function (target, eventName, eventTransformer) {
  var _findHandlerMethods = findHandlerMethods(target);

  var sub = _findHandlerMethods[0];
  var unsub = _findHandlerMethods[1];

  var desc = new Bacon.Desc(Bacon, "fromEvent", [target, eventName]);
  return withDesc(desc, Bacon.fromBinder(function (handler) {
    sub.call(target, eventName, handler);
    return function () {
      return unsub.call(target, eventName, handler);
    };
  }, eventTransformer));
};

Bacon.fromEvent = Bacon.fromEventTarget;

Bacon.fromPoll = function (delay, poll) {
  var desc = new Bacon.Desc(Bacon, "fromPoll", [delay, poll]);
  return withDesc(desc, Bacon.fromBinder(function (handler) {
    var id = Bacon.scheduler.setInterval(handler, delay);
    return function () {
      return Bacon.scheduler.clearInterval(id);
    };
  }, poll));
};

function valueAndEnd(value) {
  return [value, endEvent()];
}

Bacon.fromPromise = function (promise, abort) {
  var eventTransformer = arguments.length <= 2 || arguments[2] === undefined ? valueAndEnd : arguments[2];

  return withDesc(new Bacon.Desc(Bacon, "fromPromise", [promise]), Bacon.fromBinder(function (handler) {
    var bound = promise.then(handler, function (e) {
      return handler(new Error(e));
    });
    if (bound && typeof bound.done === "function") {
      bound.done();
    }

    if (abort) {
      return function () {
        if (typeof promise.abort === "function") {
          return promise.abort();
        }
      };
    } else {
      return function () {};
    }
  }, eventTransformer));
};

Bacon.Observable.prototype.groupBy = function (keyF) {
  var limitF = arguments.length <= 1 || arguments[1] === undefined ? Bacon._.id : arguments[1];

  var streams = {};
  var src = this;
  return src.filter(function (x) {
    return !streams[keyF(x)];
  }).map(function (x) {
    var key = keyF(x);
    var similar = src.filter(function (x) {
      return keyF(x) === key;
    });
    var data = Bacon.once(x).concat(similar);
    var limited = limitF(data, x).withHandler(function (event) {
      this.push(event);
      if (event.isEnd()) {
        return delete streams[key];
      }
    });
    streams[key] = limited;
    return limited;
  });
};

Bacon.fromArray = function (values) {
  assertArray(values);
  if (!values.length) {
    return withDesc(new Bacon.Desc(Bacon, "fromArray", values), Bacon.never());
  } else {
    var i = 0;
    return new EventStream(new Bacon.Desc(Bacon, "fromArray", [values]), function (sink) {
      var unsubd = false;
      var reply = Bacon.more;
      var pushing = false;
      var pushNeeded = false;
      var push = function () {
        pushNeeded = true;
        if (pushing) {
          return;
        }
        pushing = true;
        while (pushNeeded) {
          pushNeeded = false;
          if (reply !== Bacon.noMore && !unsubd) {
            var value = values[i++];
            reply = sink(toEvent(value));
            if (reply !== Bacon.noMore) {
              if (i === values.length) {
                sink(endEvent());
              } else {
                UpdateBarrier.afterTransaction(push);
              }
            }
          }
        }
        pushing = false;
        return pushing;
      };

      push();
      return function () {
        unsubd = true;
        return unsubd;
      };
    });
  }
};

Bacon.EventStream.prototype.holdWhen = function (valve) {
  var onHold = false;
  var bufferedValues = [];
  var src = this;
  var srcIsEnded = false;
  return new EventStream(new Bacon.Desc(this, "holdWhen", [valve]), function (sink) {
    var composite = new CompositeUnsubscribe();
    var subscribed = false;
    var endIfBothEnded = function (unsub) {
      if (typeof unsub === "function") {
        unsub();
      }
      if (composite.empty() && subscribed) {
        return sink(endEvent());
      }
    };
    composite.add(function (unsubAll, unsubMe) {
      return valve.subscribeInternal(function (event) {
        if (event.hasValue()) {
          onHold = event.value();
          if (!onHold) {
            var toSend = bufferedValues;
            bufferedValues = [];
            return (function () {
              var result = [];
              for (var i = 0, value; i < toSend.length; i++) {
                value = toSend[i];
                result.push(sink(nextEvent(value)));
              }
              if (srcIsEnded) {
                result.push(sink(endEvent()));
                unsubMe();
              }
              return result;
            })();
          }
        } else if (event.isEnd()) {
          return endIfBothEnded(unsubMe);
        } else {
          return sink(event);
        }
      });
    });
    composite.add(function (unsubAll, unsubMe) {
      return src.subscribeInternal(function (event) {
        if (onHold && event.hasValue()) {
          return bufferedValues.push(event.value());
        } else if (event.isEnd() && bufferedValues.length) {
          srcIsEnded = true;
          return endIfBothEnded(unsubMe);
        } else {
          return sink(event);
        }
      });
    });
    subscribed = true;
    endIfBothEnded();
    return composite.unsubscribe;
  });
};

Bacon.interval = function (delay) {
  var value = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  return withDesc(new Bacon.Desc(Bacon, "interval", [delay, value]), Bacon.fromPoll(delay, function () {
    return nextEvent(value);
  }));
};

Bacon.$ = {};
Bacon.$.asEventStream = function (eventName, selector, eventTransformer) {
  var _this11 = this;

  if (_.isFunction(selector)) {
    eventTransformer = selector;
    selector = undefined;
  }

  return withDesc(new Bacon.Desc(this.selector || this, "asEventStream", [eventName]), Bacon.fromBinder(function (handler) {
    _this11.on(eventName, selector, handler);
    return function () {
      return _this11.off(eventName, selector, handler);
    };
  }, eventTransformer));
};

if (typeof jQuery !== "undefined" && jQuery) {
  jQuery.fn.asEventStream = Bacon.$.asEventStream;
}

if (typeof Zepto !== "undefined" && Zepto) {
  Zepto.fn.asEventStream = Bacon.$.asEventStream;
}

Bacon.Observable.prototype.last = function () {
  var lastEvent;

  return withDesc(new Bacon.Desc(this, "last", []), this.withHandler(function (event) {
    if (event.isEnd()) {
      if (lastEvent) {
        this.push(lastEvent);
      }
      this.push(endEvent());
      return Bacon.noMore;
    } else {
      lastEvent = event;
    }
  }));
};

Bacon.Observable.prototype.log = function () {
  for (var _len18 = arguments.length, args = Array(_len18), _key18 = 0; _key18 < _len18; _key18++) {
    args[_key18] = arguments[_key18];
  }

  this.subscribe(function (event) {
    if (typeof console !== "undefined" && typeof console.log === "function") {
      console.log.apply(console, args.concat([event.log()]));
    }
  });
  return this;
};

Bacon.EventStream.prototype.merge = function (right) {
  assertEventStream(right);
  var left = this;
  return withDesc(new Bacon.Desc(left, "merge", [right]), Bacon.mergeAll(this, right));
};

Bacon.mergeAll = function () {
  var streams = argumentsToObservables(arguments);
  if (streams.length) {
    return new EventStream(new Bacon.Desc(Bacon, "mergeAll", streams), function (sink) {
      var ends = 0;
      var smartSink = function (obs) {
        return function (unsubBoth) {
          return obs.dispatcher.subscribe(function (event) {
            if (event.isEnd()) {
              ends++;
              if (ends === streams.length) {
                return sink(endEvent());
              } else {
                return Bacon.more;
              }
            } else {
              var reply = sink(event);
              if (reply === Bacon.noMore) {
                unsubBoth();
              }
              return reply;
            }
          });
        };
      };
      var sinks = _.map(smartSink, streams);
      return new Bacon.CompositeUnsubscribe(sinks).unsubscribe;
    });
  } else {
    return Bacon.never();
  }
};

Bacon.repeatedly = function (delay, values) {
  var index = 0;
  return withDesc(new Bacon.Desc(Bacon, "repeatedly", [delay, values]), Bacon.fromPoll(delay, function () {
    return values[index++ % values.length];
  }));
};

Bacon.repeat = function (generator) {
  var index = 0;
  return Bacon.fromBinder(function (sink) {
    var flag = false;
    var reply = Bacon.more;
    var unsub = function () {};
    function handleEvent(event) {
      if (event.isEnd()) {
        if (!flag) {
          return flag = true;
        } else {
          return subscribeNext();
        }
      } else {
        return reply = sink(event);
      }
    };
    function subscribeNext() {
      var next;
      flag = true;
      while (flag && reply !== Bacon.noMore) {
        next = generator(index++);
        flag = false;
        if (next) {
          unsub = next.subscribeInternal(handleEvent);
        } else {
          sink(endEvent());
        }
      }
      return flag = true;
    };
    subscribeNext();
    return function () {
      return unsub();
    };
  });
};

Bacon.retry = function (options) {
  if (!_.isFunction(options.source)) {
    throw new Exception("'source' option has to be a function");
  }
  var source = options.source;
  var retries = options.retries || 0;
  var retriesDone = 0;
  var delay = options.delay || function () {
    return 0;
  };
  var isRetryable = options.isRetryable || function () {
    return true;
  };
  var finished = false;
  var error = null;

  return withDesc(new Bacon.Desc(Bacon, "retry", [options]), Bacon.repeat(function () {
    function valueStream() {
      return source().endOnError().withHandler(function (event) {
        if (event.isError()) {
          error = event;
          if (!(isRetryable(error.error) && (retries === 0 || retriesDone < retries))) {
            finished = true;
            return this.push(event);
          }
        } else {
          if (event.hasValue()) {
            error = null;
            finished = true;
          }
          return this.push(event);
        }
      });
    }

    if (finished) {
      return null;
    } else if (error) {
      var context = {
        error: error.error,
        retriesDone: retriesDone
      };
      var pause = Bacon.later(delay(context)).filter(false);
      retriesDone++;
      return pause.concat(Bacon.once().flatMap(valueStream));
    } else {
      return valueStream();
    }
  }));
};

Bacon.sequentially = function (delay, values) {
  var index = 0;
  return withDesc(new Bacon.Desc(Bacon, "sequentially", [delay, values]), Bacon.fromPoll(delay, function () {
    var value = values[index++];
    if (index < values.length) {
      return value;
    } else if (index === values.length) {
      return [value, endEvent()];
    } else {
      return endEvent();
    }
  }));
};

Bacon.Observable.prototype.skip = function (count) {
  return withDesc(new Bacon.Desc(this, "skip", [count]), this.withHandler(function (event) {
    if (!event.hasValue()) {
      return this.push(event);
    } else if (count > 0) {
      count--;
      return Bacon.more;
    } else {
      return this.push(event);
    }
  }));
};

Bacon.EventStream.prototype.skipUntil = function (starter) {
  var started = starter.take(1).map(true).toProperty(false);
  return withDesc(new Bacon.Desc(this, "skipUntil", [starter]), this.filter(started));
};

Bacon.EventStream.prototype.skipWhile = function (f) {
  assertObservableIsProperty(f);
  var ok = false;

  for (var _len19 = arguments.length, args = Array(_len19 > 1 ? _len19 - 1 : 0), _key19 = 1; _key19 < _len19; _key19++) {
    args[_key19 - 1] = arguments[_key19];
  }

  return convertArgsToFunction(this, f, args, function (f) {
    return withDesc(new Bacon.Desc(this, "skipWhile", [f]), this.withHandler(function (event) {
      if (ok || !event.hasValue() || !f(event.value())) {
        if (event.hasValue()) {
          ok = true;
        }
        return this.push(event);
      } else {
        return Bacon.more;
      }
    }));
  });
};

Bacon.Observable.prototype.slidingWindow = function (n) {
  var minValues = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

  return withDesc(new Bacon.Desc(this, "slidingWindow", [n, minValues]), this.scan([], function (window, value) {
    return window.concat([value]).slice(-n);
  }).filter(function (values) {
    return values.length >= minValues;
  }));
};

var spies = [];
var registerObs = function (obs) {
  if (spies.length) {
    if (!registerObs.running) {
      try {
        registerObs.running = true;
        spies.forEach(function (spy) {
          spy(obs);
        });
      } finally {
        delete registerObs.running;
      }
    }
  }
};

Bacon.spy = function (spy) {
  return spies.push(spy);
};

Bacon.Property.prototype.startWith = function (seed) {
  return withDesc(new Bacon.Desc(this, "startWith", [seed]), this.scan(seed, function (prev, next) {
    return next;
  }));
};

Bacon.EventStream.prototype.startWith = function (seed) {
  return withDesc(new Bacon.Desc(this, "startWith", [seed]), Bacon.once(seed).concat(this));
};

Bacon.Observable.prototype.takeWhile = function (f) {
  assertObservableIsProperty(f);

  for (var _len20 = arguments.length, args = Array(_len20 > 1 ? _len20 - 1 : 0), _key20 = 1; _key20 < _len20; _key20++) {
    args[_key20 - 1] = arguments[_key20];
  }

  return convertArgsToFunction(this, f, args, function (f) {
    return withDesc(new Bacon.Desc(this, "takeWhile", [f]), this.withHandler(function (event) {
      if (event.filter(f)) {
        return this.push(event);
      } else {
        this.push(endEvent());
        return Bacon.noMore;
      }
    }));
  });
};

Bacon.EventStream.prototype.throttle = function (delay) {
  return withDesc(new Bacon.Desc(this, "throttle", [delay]), this.bufferWithTime(delay).map(function (values) {
    return values[values.length - 1];
  }));
};

Bacon.Property.prototype.throttle = function (delay) {
  return this.delayChanges(new Bacon.Desc(this, "throttle", [delay]), function (changes) {
    return changes.throttle(delay);
  });
};

Observable.prototype.firstToPromise = function (PromiseCtr) {
  var _this12 = this;

  if (typeof PromiseCtr !== "function") {
    if (typeof Promise === "function") {
      PromiseCtr = Promise;
    } else {
      throw new Exception("There isn't default Promise, use shim or parameter");
    }
  }

  return new PromiseCtr(function (resolve, reject) {
    return _this12.subscribe(function (event) {
      if (event.hasValue()) {
        resolve(event.value());
      }
      if (event.isError()) {
        reject(event.error);
      }

      return Bacon.noMore;
    });
  });
};

Observable.prototype.toPromise = function (PromiseCtr) {
  return this.last().firstToPromise(PromiseCtr);
};

Bacon["try"] = function (f) {
  return function (value) {
    try {
      return Bacon.once(f(value));
    } catch (e) {
      return new Bacon.Error(e);
    }
  };
};

Bacon.update = function (initial) {
  function lateBindFirst(f) {
    return function () {
      for (var _len22 = arguments.length, args = Array(_len22), _key22 = 0; _key22 < _len22; _key22++) {
        args[_key22] = arguments[_key22];
      }

      return function (i) {
        return f.apply(undefined, [i].concat(args));
      };
    };
  }

  for (var _len21 = arguments.length, patterns = Array(_len21 > 1 ? _len21 - 1 : 0), _key21 = 1; _key21 < _len21; _key21++) {
    patterns[_key21 - 1] = arguments[_key21];
  }

  var i = patterns.length - 1;
  while (i > 0) {
    if (!(patterns[i] instanceof Function)) {
      patterns[i] = _.always(patterns[i]);
    }
    patterns[i] = lateBindFirst(patterns[i]);
    i = i - 2;
  }
  return withDesc(new Bacon.Desc(Bacon, "update", [initial].concat(patterns)), Bacon.when.apply(Bacon, patterns).scan(initial, function (x, f) {
    return f(x);
  }));
};

Bacon.zipAsArray = function () {
  for (var _len23 = arguments.length, args = Array(_len23), _key23 = 0; _key23 < _len23; _key23++) {
    args[_key23] = arguments[_key23];
  }

  var streams = argumentsToObservables(args);
  return withDesc(new Bacon.Desc(Bacon, "zipAsArray", streams), Bacon.zipWith(streams, function () {
    for (var _len24 = arguments.length, xs = Array(_len24), _key24 = 0; _key24 < _len24; _key24++) {
      xs[_key24] = arguments[_key24];
    }

    return xs;
  }));
};

Bacon.zipWith = function () {
  for (var _len25 = arguments.length, args = Array(_len25), _key25 = 0; _key25 < _len25; _key25++) {
    args[_key25] = arguments[_key25];
  }

  var observablesAndFunction = argumentsToObservablesAndFunction(args);
  var streams = observablesAndFunction[0];
  var f = observablesAndFunction[1];

  streams = _.map(function (s) {
    return s.toEventStream();
  }, streams);
  return withDesc(new Bacon.Desc(Bacon, "zipWith", [f].concat(streams)), Bacon.when(streams, f));
};

Bacon.Observable.prototype.zip = function (other, f) {
  return withDesc(new Bacon.Desc(this, "zip", [other]), Bacon.zipWith([this, other], f || Array));
};

if (typeof define !== "undefined" && define !== null && define.amd != null) {
  define([], function () {
    return Bacon;
  });
  if (typeof this !== "undefined" && this !== null) {
    this.Bacon = Bacon;
  }
} else if (typeof module !== "undefined" && module !== null && module.exports != null) {
  module.exports = Bacon;
  Bacon.Bacon = Bacon;
} else {
    this.Bacon = Bacon;
  }
}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],35:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.1.20160328
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /Version\/[\d\.]+.*Safari/.test(navigator.userAgent)
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			/* // Take note W3C:
			var
			  uri = typeof file === "string" ? file : file.toURL()
			, revoker = function(evt) {
				// idealy DownloadFinishedEvent.data would be the URL requested
				if (evt.data === uri) {
					if (typeof file === "string") { // file is an object URL
						get_URL().revokeObjectURL(file);
					} else { // file is a File
						file.remove();
					}
				}
			}
			;
			view.addEventListener("downloadfinished", revoker);
			*/
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob(["\ufeff", blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if (target_view && is_safari && typeof FileReader !== "undefined") {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var base64Data = reader.result;
							target_view.location.href = "data:attachment/file" + base64Data.slice(base64Data.search(/[,;]/));
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab === undefined && is_safari) {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name, no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name || "download");
		};
	}

	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define([], function() {
    return saveAs;
  });
}

},{}],36:[function(require,module,exports){
/*global define:false */
/**
 * Copyright 2016 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.6.0
 * @url craig.is/killing/mice
 */
(function(window, document, undefined) {

    // Check if mousetrap is used inside browser, if not, return
    if (!window) {
        return;
    }

    /**
     * mapping of special keycodes to their corresponding keys
     *
     * everything in this dictionary cannot use keypress events
     * so it has to be here to map to the correct keycodes for
     * keyup/keydown events
     *
     * @type {Object}
     */
    var _MAP = {
        8: 'backspace',
        9: 'tab',
        13: 'enter',
        16: 'shift',
        17: 'ctrl',
        18: 'alt',
        20: 'capslock',
        27: 'esc',
        32: 'space',
        33: 'pageup',
        34: 'pagedown',
        35: 'end',
        36: 'home',
        37: 'left',
        38: 'up',
        39: 'right',
        40: 'down',
        45: 'ins',
        46: 'del',
        91: 'meta',
        93: 'meta',
        224: 'meta'
    };

    /**
     * mapping for special characters so they can support
     *
     * this dictionary is only used incase you want to bind a
     * keyup or keydown event to one of these keys
     *
     * @type {Object}
     */
    var _KEYCODE_MAP = {
        106: '*',
        107: '+',
        109: '-',
        110: '.',
        111 : '/',
        186: ';',
        187: '=',
        188: ',',
        189: '-',
        190: '.',
        191: '/',
        192: '`',
        219: '[',
        220: '\\',
        221: ']',
        222: '\''
    };

    /**
     * this is a mapping of keys that require shift on a US keypad
     * back to the non shift equivelents
     *
     * this is so you can use keyup events with these keys
     *
     * note that this will only work reliably on US keyboards
     *
     * @type {Object}
     */
    var _SHIFT_MAP = {
        '~': '`',
        '!': '1',
        '@': '2',
        '#': '3',
        '$': '4',
        '%': '5',
        '^': '6',
        '&': '7',
        '*': '8',
        '(': '9',
        ')': '0',
        '_': '-',
        '+': '=',
        ':': ';',
        '\"': '\'',
        '<': ',',
        '>': '.',
        '?': '/',
        '|': '\\'
    };

    /**
     * this is a list of special strings you can use to map
     * to modifier keys when you specify your keyboard shortcuts
     *
     * @type {Object}
     */
    var _SPECIAL_ALIASES = {
        'option': 'alt',
        'command': 'meta',
        'return': 'enter',
        'escape': 'esc',
        'plus': '+',
        'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
    };

    /**
     * variable to store the flipped version of _MAP from above
     * needed to check if we should use keypress or not when no action
     * is specified
     *
     * @type {Object|undefined}
     */
    var _REVERSE_MAP;

    /**
     * loop through the f keys, f1 to f19 and add them to the map
     * programatically
     */
    for (var i = 1; i < 20; ++i) {
        _MAP[111 + i] = 'f' + i;
    }

    /**
     * loop through to map numbers on the numeric keypad
     */
    for (i = 0; i <= 9; ++i) {
        _MAP[i + 96] = i;
    }

    /**
     * cross browser add event method
     *
     * @param {Element|HTMLDocument} object
     * @param {string} type
     * @param {Function} callback
     * @returns void
     */
    function _addEvent(object, type, callback) {
        if (object.addEventListener) {
            object.addEventListener(type, callback, false);
            return;
        }

        object.attachEvent('on' + type, callback);
    }

    /**
     * takes the event and returns the key character
     *
     * @param {Event} e
     * @return {string}
     */
    function _characterFromEvent(e) {

        // for keypress events we should return the character as is
        if (e.type == 'keypress') {
            var character = String.fromCharCode(e.which);

            // if the shift key is not pressed then it is safe to assume
            // that we want the character to be lowercase.  this means if
            // you accidentally have caps lock on then your key bindings
            // will continue to work
            //
            // the only side effect that might not be desired is if you
            // bind something like 'A' cause you want to trigger an
            // event when capital A is pressed caps lock will no longer
            // trigger the event.  shift+a will though.
            if (!e.shiftKey) {
                character = character.toLowerCase();
            }

            return character;
        }

        // for non keypress events the special maps are needed
        if (_MAP[e.which]) {
            return _MAP[e.which];
        }

        if (_KEYCODE_MAP[e.which]) {
            return _KEYCODE_MAP[e.which];
        }

        // if it is not in the special map

        // with keydown and keyup events the character seems to always
        // come in as an uppercase character whether you are pressing shift
        // or not.  we should make sure it is always lowercase for comparisons
        return String.fromCharCode(e.which).toLowerCase();
    }

    /**
     * checks if two arrays are equal
     *
     * @param {Array} modifiers1
     * @param {Array} modifiers2
     * @returns {boolean}
     */
    function _modifiersMatch(modifiers1, modifiers2) {
        return modifiers1.sort().join(',') === modifiers2.sort().join(',');
    }

    /**
     * takes a key event and figures out what the modifiers are
     *
     * @param {Event} e
     * @returns {Array}
     */
    function _eventModifiers(e) {
        var modifiers = [];

        if (e.shiftKey) {
            modifiers.push('shift');
        }

        if (e.altKey) {
            modifiers.push('alt');
        }

        if (e.ctrlKey) {
            modifiers.push('ctrl');
        }

        if (e.metaKey) {
            modifiers.push('meta');
        }

        return modifiers;
    }

    /**
     * prevents default for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _preventDefault(e) {
        if (e.preventDefault) {
            e.preventDefault();
            return;
        }

        e.returnValue = false;
    }

    /**
     * stops propogation for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _stopPropagation(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
            return;
        }

        e.cancelBubble = true;
    }

    /**
     * determines if the keycode specified is a modifier key or not
     *
     * @param {string} key
     * @returns {boolean}
     */
    function _isModifier(key) {
        return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
    }

    /**
     * reverses the map lookup so that we can look for specific keys
     * to see what can and can't use keypress
     *
     * @return {Object}
     */
    function _getReverseMap() {
        if (!_REVERSE_MAP) {
            _REVERSE_MAP = {};
            for (var key in _MAP) {

                // pull out the numeric keypad from here cause keypress should
                // be able to detect the keys from the character
                if (key > 95 && key < 112) {
                    continue;
                }

                if (_MAP.hasOwnProperty(key)) {
                    _REVERSE_MAP[_MAP[key]] = key;
                }
            }
        }
        return _REVERSE_MAP;
    }

    /**
     * picks the best action based on the key combination
     *
     * @param {string} key - character for key
     * @param {Array} modifiers
     * @param {string=} action passed in
     */
    function _pickBestAction(key, modifiers, action) {

        // if no action was picked in we should try to pick the one
        // that we think would work best for this key
        if (!action) {
            action = _getReverseMap()[key] ? 'keydown' : 'keypress';
        }

        // modifier keys don't work as expected with keypress,
        // switch to keydown
        if (action == 'keypress' && modifiers.length) {
            action = 'keydown';
        }

        return action;
    }

    /**
     * Converts from a string key combination to an array
     *
     * @param  {string} combination like "command+shift+l"
     * @return {Array}
     */
    function _keysFromString(combination) {
        if (combination === '+') {
            return ['+'];
        }

        combination = combination.replace(/\+{2}/g, '+plus');
        return combination.split('+');
    }

    /**
     * Gets info for a specific key combination
     *
     * @param  {string} combination key combination ("command+s" or "a" or "*")
     * @param  {string=} action
     * @returns {Object}
     */
    function _getKeyInfo(combination, action) {
        var keys;
        var key;
        var i;
        var modifiers = [];

        // take the keys from this pattern and figure out what the actual
        // pattern is all about
        keys = _keysFromString(combination);

        for (i = 0; i < keys.length; ++i) {
            key = keys[i];

            // normalize key names
            if (_SPECIAL_ALIASES[key]) {
                key = _SPECIAL_ALIASES[key];
            }

            // if this is not a keypress event then we should
            // be smart about using shift keys
            // this will only work for US keyboards however
            if (action && action != 'keypress' && _SHIFT_MAP[key]) {
                key = _SHIFT_MAP[key];
                modifiers.push('shift');
            }

            // if this key is a modifier then add it to the list of modifiers
            if (_isModifier(key)) {
                modifiers.push(key);
            }
        }

        // depending on what the key combination is
        // we will try to pick the best event for it
        action = _pickBestAction(key, modifiers, action);

        return {
            key: key,
            modifiers: modifiers,
            action: action
        };
    }

    function _belongsTo(element, ancestor) {
        if (element === null || element === document) {
            return false;
        }

        if (element === ancestor) {
            return true;
        }

        return _belongsTo(element.parentNode, ancestor);
    }

    function Mousetrap(targetElement) {
        var self = this;

        targetElement = targetElement || document;

        if (!(self instanceof Mousetrap)) {
            return new Mousetrap(targetElement);
        }

        /**
         * element to attach key events to
         *
         * @type {Element}
         */
        self.target = targetElement;

        /**
         * a list of all the callbacks setup via Mousetrap.bind()
         *
         * @type {Object}
         */
        self._callbacks = {};

        /**
         * direct map of string combinations to callbacks used for trigger()
         *
         * @type {Object}
         */
        self._directMap = {};

        /**
         * keeps track of what level each sequence is at since multiple
         * sequences can start out with the same sequence
         *
         * @type {Object}
         */
        var _sequenceLevels = {};

        /**
         * variable to store the setTimeout call
         *
         * @type {null|number}
         */
        var _resetTimer;

        /**
         * temporary state where we will ignore the next keyup
         *
         * @type {boolean|string}
         */
        var _ignoreNextKeyup = false;

        /**
         * temporary state where we will ignore the next keypress
         *
         * @type {boolean}
         */
        var _ignoreNextKeypress = false;

        /**
         * are we currently inside of a sequence?
         * type of action ("keyup" or "keydown" or "keypress") or false
         *
         * @type {boolean|string}
         */
        var _nextExpectedAction = false;

        /**
         * resets all sequence counters except for the ones passed in
         *
         * @param {Object} doNotReset
         * @returns void
         */
        function _resetSequences(doNotReset) {
            doNotReset = doNotReset || {};

            var activeSequences = false,
                key;

            for (key in _sequenceLevels) {
                if (doNotReset[key]) {
                    activeSequences = true;
                    continue;
                }
                _sequenceLevels[key] = 0;
            }

            if (!activeSequences) {
                _nextExpectedAction = false;
            }
        }

        /**
         * finds all callbacks that match based on the keycode, modifiers,
         * and action
         *
         * @param {string} character
         * @param {Array} modifiers
         * @param {Event|Object} e
         * @param {string=} sequenceName - name of the sequence we are looking for
         * @param {string=} combination
         * @param {number=} level
         * @returns {Array}
         */
        function _getMatches(character, modifiers, e, sequenceName, combination, level) {
            var i;
            var callback;
            var matches = [];
            var action = e.type;

            // if there are no events related to this keycode
            if (!self._callbacks[character]) {
                return [];
            }

            // if a modifier key is coming up on its own we should allow it
            if (action == 'keyup' && _isModifier(character)) {
                modifiers = [character];
            }

            // loop through all callbacks for the key that was pressed
            // and see if any of them match
            for (i = 0; i < self._callbacks[character].length; ++i) {
                callback = self._callbacks[character][i];

                // if a sequence name is not specified, but this is a sequence at
                // the wrong level then move onto the next match
                if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
                    continue;
                }

                // if the action we are looking for doesn't match the action we got
                // then we should keep going
                if (action != callback.action) {
                    continue;
                }

                // if this is a keypress event and the meta key and control key
                // are not pressed that means that we need to only look at the
                // character, otherwise check the modifiers as well
                //
                // chrome will not fire a keypress if meta or control is down
                // safari will fire a keypress if meta or meta+shift is down
                // firefox will fire a keypress if meta or control is down
                if ((action == 'keypress' && !e.metaKey && !e.ctrlKey) || _modifiersMatch(modifiers, callback.modifiers)) {

                    // when you bind a combination or sequence a second time it
                    // should overwrite the first one.  if a sequenceName or
                    // combination is specified in this call it does just that
                    //
                    // @todo make deleting its own method?
                    var deleteCombo = !sequenceName && callback.combo == combination;
                    var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
                    if (deleteCombo || deleteSequence) {
                        self._callbacks[character].splice(i, 1);
                    }

                    matches.push(callback);
                }
            }

            return matches;
        }

        /**
         * actually calls the callback function
         *
         * if your callback function returns false this will use the jquery
         * convention - prevent default and stop propogation on the event
         *
         * @param {Function} callback
         * @param {Event} e
         * @returns void
         */
        function _fireCallback(callback, e, combo, sequence) {

            // if this event should not happen stop here
            if (self.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
                return;
            }

            if (callback(e, combo) === false) {
                _preventDefault(e);
                _stopPropagation(e);
            }
        }

        /**
         * handles a character key event
         *
         * @param {string} character
         * @param {Array} modifiers
         * @param {Event} e
         * @returns void
         */
        self._handleKey = function(character, modifiers, e) {
            var callbacks = _getMatches(character, modifiers, e);
            var i;
            var doNotReset = {};
            var maxLevel = 0;
            var processedSequenceCallback = false;

            // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
            for (i = 0; i < callbacks.length; ++i) {
                if (callbacks[i].seq) {
                    maxLevel = Math.max(maxLevel, callbacks[i].level);
                }
            }

            // loop through matching callbacks for this key event
            for (i = 0; i < callbacks.length; ++i) {

                // fire for all sequence callbacks
                // this is because if for example you have multiple sequences
                // bound such as "g i" and "g t" they both need to fire the
                // callback for matching g cause otherwise you can only ever
                // match the first one
                if (callbacks[i].seq) {

                    // only fire callbacks for the maxLevel to prevent
                    // subsequences from also firing
                    //
                    // for example 'a option b' should not cause 'option b' to fire
                    // even though 'option b' is part of the other sequence
                    //
                    // any sequences that do not match here will be discarded
                    // below by the _resetSequences call
                    if (callbacks[i].level != maxLevel) {
                        continue;
                    }

                    processedSequenceCallback = true;

                    // keep a list of which sequences were matches for later
                    doNotReset[callbacks[i].seq] = 1;
                    _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);
                    continue;
                }

                // if there were no sequence matches but we are still here
                // that means this is a regular match so we should fire that
                if (!processedSequenceCallback) {
                    _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
                }
            }

            // if the key you pressed matches the type of sequence without
            // being a modifier (ie "keyup" or "keypress") then we should
            // reset all sequences that were not matched by this event
            //
            // this is so, for example, if you have the sequence "h a t" and you
            // type "h e a r t" it does not match.  in this case the "e" will
            // cause the sequence to reset
            //
            // modifier keys are ignored because you can have a sequence
            // that contains modifiers such as "enter ctrl+space" and in most
            // cases the modifier key will be pressed before the next key
            //
            // also if you have a sequence such as "ctrl+b a" then pressing the
            // "b" key will trigger a "keypress" and a "keydown"
            //
            // the "keydown" is expected when there is a modifier, but the
            // "keypress" ends up matching the _nextExpectedAction since it occurs
            // after and that causes the sequence to reset
            //
            // we ignore keypresses in a sequence that directly follow a keydown
            // for the same character
            var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
            if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
                _resetSequences(doNotReset);
            }

            _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
        };

        /**
         * handles a keydown event
         *
         * @param {Event} e
         * @returns void
         */
        function _handleKeyEvent(e) {

            // normalize e.which for key events
            // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
            if (typeof e.which !== 'number') {
                e.which = e.keyCode;
            }

            var character = _characterFromEvent(e);

            // no character found then stop
            if (!character) {
                return;
            }

            // need to use === for the character check because the character can be 0
            if (e.type == 'keyup' && _ignoreNextKeyup === character) {
                _ignoreNextKeyup = false;
                return;
            }

            self.handleKey(character, _eventModifiers(e), e);
        }

        /**
         * called to set a 1 second timeout on the specified sequence
         *
         * this is so after each key press in the sequence you have 1 second
         * to press the next key before you have to start over
         *
         * @returns void
         */
        function _resetSequenceTimer() {
            clearTimeout(_resetTimer);
            _resetTimer = setTimeout(_resetSequences, 1000);
        }

        /**
         * binds a key sequence to an event
         *
         * @param {string} combo - combo specified in bind call
         * @param {Array} keys
         * @param {Function} callback
         * @param {string=} action
         * @returns void
         */
        function _bindSequence(combo, keys, callback, action) {

            // start off by adding a sequence level record for this combination
            // and setting the level to 0
            _sequenceLevels[combo] = 0;

            /**
             * callback to increase the sequence level for this sequence and reset
             * all other sequences that were active
             *
             * @param {string} nextAction
             * @returns {Function}
             */
            function _increaseSequence(nextAction) {
                return function() {
                    _nextExpectedAction = nextAction;
                    ++_sequenceLevels[combo];
                    _resetSequenceTimer();
                };
            }

            /**
             * wraps the specified callback inside of another function in order
             * to reset all sequence counters as soon as this sequence is done
             *
             * @param {Event} e
             * @returns void
             */
            function _callbackAndReset(e) {
                _fireCallback(callback, e, combo);

                // we should ignore the next key up if the action is key down
                // or keypress.  this is so if you finish a sequence and
                // release the key the final key will not trigger a keyup
                if (action !== 'keyup') {
                    _ignoreNextKeyup = _characterFromEvent(e);
                }

                // weird race condition if a sequence ends with the key
                // another sequence begins with
                setTimeout(_resetSequences, 10);
            }

            // loop through keys one at a time and bind the appropriate callback
            // function.  for any key leading up to the final one it should
            // increase the sequence. after the final, it should reset all sequences
            //
            // if an action is specified in the original bind call then that will
            // be used throughout.  otherwise we will pass the action that the
            // next key in the sequence should match.  this allows a sequence
            // to mix and match keypress and keydown events depending on which
            // ones are better suited to the key provided
            for (var i = 0; i < keys.length; ++i) {
                var isFinal = i + 1 === keys.length;
                var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
                _bindSingle(keys[i], wrappedCallback, action, combo, i);
            }
        }

        /**
         * binds a single keyboard combination
         *
         * @param {string} combination
         * @param {Function} callback
         * @param {string=} action
         * @param {string=} sequenceName - name of sequence if part of sequence
         * @param {number=} level - what part of the sequence the command is
         * @returns void
         */
        function _bindSingle(combination, callback, action, sequenceName, level) {

            // store a direct mapped reference for use with Mousetrap.trigger
            self._directMap[combination + ':' + action] = callback;

            // make sure multiple spaces in a row become a single space
            combination = combination.replace(/\s+/g, ' ');

            var sequence = combination.split(' ');
            var info;

            // if this pattern is a sequence of keys then run through this method
            // to reprocess each pattern one key at a time
            if (sequence.length > 1) {
                _bindSequence(combination, sequence, callback, action);
                return;
            }

            info = _getKeyInfo(combination, action);

            // make sure to initialize array if this is the first time
            // a callback is added for this key
            self._callbacks[info.key] = self._callbacks[info.key] || [];

            // remove an existing match if there is one
            _getMatches(info.key, info.modifiers, {type: info.action}, sequenceName, combination, level);

            // add this call back to the array
            // if it is a sequence put it at the beginning
            // if not put it at the end
            //
            // this is important because the way these are processed expects
            // the sequence ones to come first
            self._callbacks[info.key][sequenceName ? 'unshift' : 'push']({
                callback: callback,
                modifiers: info.modifiers,
                action: info.action,
                seq: sequenceName,
                level: level,
                combo: combination
            });
        }

        /**
         * binds multiple combinations to the same callback
         *
         * @param {Array} combinations
         * @param {Function} callback
         * @param {string|undefined} action
         * @returns void
         */
        self._bindMultiple = function(combinations, callback, action) {
            for (var i = 0; i < combinations.length; ++i) {
                _bindSingle(combinations[i], callback, action);
            }
        };

        // start!
        _addEvent(targetElement, 'keypress', _handleKeyEvent);
        _addEvent(targetElement, 'keydown', _handleKeyEvent);
        _addEvent(targetElement, 'keyup', _handleKeyEvent);
    }

    /**
     * binds an event to mousetrap
     *
     * can be a single key, a combination of keys separated with +,
     * an array of keys, or a sequence of keys separated by spaces
     *
     * be sure to list the modifier keys first to make sure that the
     * correct key ends up getting bound (the last key in the pattern)
     *
     * @param {string|Array} keys
     * @param {Function} callback
     * @param {string=} action - 'keypress', 'keydown', or 'keyup'
     * @returns void
     */
    Mousetrap.prototype.bind = function(keys, callback, action) {
        var self = this;
        keys = keys instanceof Array ? keys : [keys];
        self._bindMultiple.call(self, keys, callback, action);
        return self;
    };

    /**
     * unbinds an event to mousetrap
     *
     * the unbinding sets the callback function of the specified key combo
     * to an empty function and deletes the corresponding key in the
     * _directMap dict.
     *
     * TODO: actually remove this from the _callbacks dictionary instead
     * of binding an empty function
     *
     * the keycombo+action has to be exactly the same as
     * it was defined in the bind method
     *
     * @param {string|Array} keys
     * @param {string} action
     * @returns void
     */
    Mousetrap.prototype.unbind = function(keys, action) {
        var self = this;
        return self.bind.call(self, keys, function() {}, action);
    };

    /**
     * triggers an event that has already been bound
     *
     * @param {string} keys
     * @param {string=} action
     * @returns void
     */
    Mousetrap.prototype.trigger = function(keys, action) {
        var self = this;
        if (self._directMap[keys + ':' + action]) {
            self._directMap[keys + ':' + action]({}, keys);
        }
        return self;
    };

    /**
     * resets the library back to its initial state.  this is useful
     * if you want to clear out the current keyboard shortcuts and bind
     * new ones - for example if you switch to another page
     *
     * @returns void
     */
    Mousetrap.prototype.reset = function() {
        var self = this;
        self._callbacks = {};
        self._directMap = {};
        return self;
    };

    /**
     * should we stop this event before firing off callbacks
     *
     * @param {Event} e
     * @param {Element} element
     * @return {boolean}
     */
    Mousetrap.prototype.stopCallback = function(e, element) {
        var self = this;

        // if the element has the class "mousetrap" then no need to stop
        if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
            return false;
        }

        if (_belongsTo(element, self.target)) {
            return false;
        }

        // stop for input, select, and textarea
        return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
    };

    /**
     * exposes _handleKey publicly so it can be overwritten by extensions
     */
    Mousetrap.prototype.handleKey = function() {
        var self = this;
        return self._handleKey.apply(self, arguments);
    };

    /**
     * allow custom key mappings
     */
    Mousetrap.addKeycodes = function(object) {
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                _MAP[key] = object[key];
            }
        }
        _REVERSE_MAP = null;
    };

    /**
     * Init the global mousetrap functions
     *
     * This method is needed to allow the global mousetrap functions to work
     * now that mousetrap is a constructor function.
     */
    Mousetrap.init = function() {
        var documentMousetrap = Mousetrap(document);
        for (var method in documentMousetrap) {
            if (method.charAt(0) !== '_') {
                Mousetrap[method] = (function(method) {
                    return function() {
                        return documentMousetrap[method].apply(documentMousetrap, arguments);
                    };
                } (method));
            }
        }
    };

    Mousetrap.init();

    // expose mousetrap to the global object
    window.Mousetrap = Mousetrap;

    // expose as a common js module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Mousetrap;
    }

    // expose mousetrap as an AMD module
    if (typeof define === 'function' && define.amd) {
        define(function() {
            return Mousetrap;
        });
    }
}) (typeof window !== 'undefined' ? window : null, typeof  window !== 'undefined' ? document : null);

},{}],37:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.tail = tail;
exports.head = head;
exports.fromPairs = fromPairs;
exports.get = get;
exports.isUndefined = isUndefined;
exports.isObject = isObject;
exports.isArray = isArray;
exports.isString = isString;
exports.isNumber = isNumber;
exports.isBoolean = isBoolean;
exports.isFunction = isFunction;
exports.notNull = notNull;
exports.mapValues = mapValues;
exports.reduceValues = reduceValues;
exports.zipArrays = zipArrays;
exports.zipObjects = zipObjects;
exports.filterValues = filterValues;
exports.any = any;
exports.tagType = tagType;
exports.checkType = checkType;
exports.match = match;
exports.hasChildren = hasChildren;
exports.checkRenderResult = checkRenderResult;
exports.updateEl = updateEl;
exports.addressWith = addressWith;
exports.addressEqual = addressEqual;
exports.makeTree = makeTree;
exports.checkState = checkState;
exports.diffWithModelMin = diffWithModelMin;
exports.makeSignal = makeSignal;
exports.makeOneSignalAPI = makeOneSignalAPI;
exports.makeChildSignalsAPI = makeChildSignalsAPI;
exports.reduceChildren = reduceChildren;
exports.mergeSignals = mergeSignals;
exports.objectOf = objectOf;
exports.arrayOf = arrayOf;
exports.createComponent = createComponent;
exports.patchMethods = patchMethods;
exports.makeCallMethod = makeCallMethod;
exports.makeCallReducer = makeCallReducer;
exports.makeStateCallers = makeStateCallers;
exports.run = run;
exports.addressToObj = addressToObj;
exports.objectForBindings = objectForBindings;
exports.createElement = createElement;
exports.bind = bind;
exports.createDOMElement = createDOMElement;
exports.getStyles = getStyles;
exports.updateDOMElement = updateDOMElement;
exports.render = render;
/** @module tinier */

// constants
var ARRAY_OF = exports.ARRAY_OF = '@TINIER_ARRAY_OF';
var OBJECT_OF = exports.OBJECT_OF = '@TINIER_OBJECT_OF';
var COMPONENT = exports.COMPONENT = '@TINIER_COMPONENT';
var ARRAY = exports.ARRAY = '@TINIER_ARRAY';
var OBJECT = exports.OBJECT = '@TINIER_OBJECT';
var NODE = exports.NODE = '@TINIER_NODE';
var NULL = exports.NULL = '@TINIER_NULL';
var STRING = exports.STRING = '@TINIER_STRING';
var NUMBER = exports.NUMBER = '@TINIER_NUMBER';
var BOOLEAN = exports.BOOLEAN = '@TINIER_BOOLEAN';
var ANY = exports.ANY = '@TINIER_ANY';
var NO_ARGUMENT = exports.NO_ARGUMENT = '@TINIER_NO_ARGUMENT';
var TOP = exports.TOP = '@TINIER_TOP';
var CREATE = exports.CREATE = '@TINIER_CREATE';
var UPDATE = exports.UPDATE = '@TINIER_UPDATE';
var DESTROY = exports.DESTROY = '@TINIER_DESTROY';

// basic functions
function noop() {}

function constant(val) {
  return function () {
    return val;
  };
}

function identity(val) {
  return val;
}

function last(array) {
  return array[array.length - 1];
}

function tail(array) {
  return [array.slice(0, -1), last(array)];
}

function head(array) {
  return [array[0], array.slice(1)];
}

function fromPairs(pairs) {
  return pairs.reduce(function (accum, _ref) {
    var _extends2;

    var key = _ref[0],
        val = _ref[1];

    return _extends({}, accum, (_extends2 = {}, _extends2[key] = val, _extends2));
  }, {});
}

/**
 * Get the property of the object or index of the array, or return the default
 * value.
 * @param {Object|Array} object - An object or array.
 * @param {String} property - An property of the object.
 * @return {*} The value of the property or, if not present, the default value.
 */
function get(object, property) {
  return object && typeof object !== 'string' && object.hasOwnProperty(property) ? object[property] : null;
}

function isUndefined(object) {
  return typeof object === 'undefined';
}

/**
 * Check if the value is an object with enumerable properties. Also returns true
 * for arrays.
 * @param {*} value - The value to test.
 * @return {Boolean}
 */
function isObject(object) {
  return object != null && (typeof object === 'undefined' ? 'undefined' : _typeof(object)) === 'object';
}

/**
 * Check if the object is an array
 * @param {*} object - The object to test.
 * @return {Boolean}
 */
function isArray(object) {
  return Array.isArray(object);
}

function isString(v) {
  return typeof v === 'string';
}

function isNumber(v) {
  return typeof v === 'number';
}

function isBoolean(v) {
  return typeof v === 'boolean';
}

/**
 * Check if the object is a function.
 * @param {*} object - The object to test.
 * @return {Boolean}
 */
function isFunction(object) {
  return typeof object === 'function';
}

function notNull(val) {
  return val !== null;
}

/**
 * Iterate over the keys and values of an object. Uses Object.keys to find
 * iterable keys.
 * @param {Object} obj - The input object.
 * @param {Function} fn - A function that takes the arguments (value, key).
 * @return {Object} A transformed object with values returned by the function.
 */
function mapValues(obj, fn) {
  var newObj = {};
  for (var key in obj) {
    newObj[key] = fn(obj[key], key);
  }
  return newObj;
}

function reduceValues(obj, fn, init) {
  var accum = init;
  for (var key in obj) {
    accum = fn(accum, obj[key], key);
  }
  return accum;
}

function zipArrays(arrays) {
  var lenLongest = Math.max.apply(null, arrays.filter(function (x) {
    return x !== null;
  }).map(function (a) {
    return a.length;
  }));
  var res = [];

  var _loop = function _loop(i) {
    res.push(arrays.map(function (a) {
      return a !== null && i < a.length ? a[i] : null;
    }));
  };

  for (var i = 0; i < lenLongest; i++) {
    _loop(i);
  }
  return res;
}

function zipObjects(objects) {
  var len = objects.length;
  // find all the keys
  var allKeys = {};
  for (var i = 0; i < len; i++) {
    var object = objects[i];
    if (object === null) {
      continue;
    }
    for (var k in object) {
      allKeys[k] = true;
    }
  }
  // make new object
  var res = {};
  for (var key in allKeys) {
    res[key] = Array(len);
    for (var _i = 0; _i < len; _i++) {
      var _object = objects[_i];
      res[key][_i] = get(_object, key);
    }
  }
  return res;
}

function filterValues(object, fn) {
  var out = {};
  for (var key in object) {
    var value = object[key];
    if (fn(value, key)) out[key] = value;
  }
  return out;
}

/**
 * Lazy any function.
 * @param {[Boolean]}
 * @return {Boolean}
 */
function any(ar) {
  for (var i = 0, l = ar.length; i < l; i++) {
    var val = ar[i];
    if (!isBoolean(val)) {
      throw new Error('Not a boolean: ' + val);
    }
    if (val) {
      return true;
    }
  }
  return false;
}

/**
 * Defers calling fn until the current process finishes.
 */
function defer(fn) {
  setTimeout(fn, 1);
}

/**
 * Adds a tag to the object.
 */
function tagType(type, obj) {
  if (!isString(type)) {
    throw new Error('First argument must be a string');
  }
  if (!isObject(obj)) {
    throw new Error('Second argument must be an object');
  }
  obj.type = type;
  return obj;
}

function checkType(type, obj) {
  if (obj === null) {
    return type === NULL;
  }
  if (typeof type !== 'string') {
    throw new Error('First argument must be a string');
  }
  if (isUndefined(obj)) {
    throw new Error('Bad second argument');
  }
  return get(obj, 'type') === type;
}

/**
 * Basic pattern matching.
 * @param {Object|null} object - An object generated with tagType, an object, an
 *                               array, or null.
 * @param {Object} fns - An object with types for keys and functions for values.
 *                       Also accepts keys tinier.OBJECT, tinier.ARRAY, and
 *                       tinier.NULL. To avoid conflict, tinier.OBJECT has the
 *                       lowest priority.
 * @param {Function} defaultFn - A function to run if the object type is not
 *                               found. Takes `object` as a single argument.
 * @return {*} Return value from the called function.
 */
function match(object, fns) {
  var defaultFn = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : throwUnrecognizedType;

  for (var key in fns) {
    if (key === NULL && object === null || key === ARRAY && isArray(object) || isObject(object) && checkType(key, object)) {
      return fns[key](object);
    }
  }
  if (OBJECT in fns && isObject(object)) {
    return fns[OBJECT](object);
  }
  return defaultFn(object);
}

function throwUnrecognizedType(node) {
  throw new Error('Unrecognized type in pattern matching: ' + node);
}

// -------------------------------------------------------------------
// Update components
// -------------------------------------------------------------------

/**
 * Determine whether the model has any child components.
 */
function hasChildren(node) {
  var _match;

  return match(node, (_match = {}, _match[ARRAY_OF] = function () {
    return true;
  }, _match[OBJECT_OF] = function () {
    return true;
  }, _match[COMPONENT] = function () {
    return true;
  }, _match[ARRAY] = function (node) {
    return any(node.map(hasChildren));
  }, _match[OBJECT] = function (node) {
    return any(Object.keys(node).map(function (k) {
      return hasChildren(node[k]);
    }));
  }, _match));
}

function checkRenderResultRecurse(userBindings, node, state) {
  var _match2;

  var updateRecurse = function updateRecurse(s, k) {
    var u = k === null ? userBindings : get(userBindings, k);
    if (userBindings !== null && u === null) {
      throw new Error('Shape of the bindings object does not match the model.' + 'Model: ' + node + '  Bindings object: ' + userBindings);
    }
  };
  var recurse = function recurse(n, k) {
    checkRenderResultRecurse(get(userBindings, k), n, get(state, k));
  };
  match(node, (_match2 = {}, _match2[OBJECT_OF] = function (objOf) {
    // check for extra attributes
    if (userBindings !== null && any(Object.keys(userBindings).map(function (k) {
      return !(k in state);
    }))) {
      throw new Error('Shape of the bindings object does not match the ' + 'model. Model: ' + node + ' Bindings object: ' + userBindings);
    } else {
      mapValues(state, updateRecurse);
    }
  }, _match2[ARRAY_OF] = function (arOf) {
    // check array lengths
    if (userBindings !== null && state.length !== userBindings.length) {
      throw new Error('Shape of the bindings object does not match the ' + 'model. Model: ' + node + ' Bindings object: ' + userBindings);
    } else {
      state.map(updateRecurse);
    }
  }, _match2[COMPONENT] = function (component) {
    return updateRecurse(state, null);
  }, _match2[ARRAY] = function (ar) {
    if (userBindings !== null && !isArray(userBindings)) {
      throw new Error('Shape of the bindings object does not match the ' + 'model. Model: ' + node + ' Bindings object: ' + userBindings);
    } else {
      ar.map(recurse);
    }
  }, _match2[OBJECT] = function (obj) {
    if (userBindings !== null && isArray(userBindings)) {
      throw new Error('Shape of the bindings object does not match the ' + 'model. Model: ' + node + ' Bindings object: ' + userBindings);
    } else {
      mapValues(obj, recurse);
    }
  }, _match2));
}

/**
 * Check the result of render against the model and state.
 * @param {Object} node - A model node.
 * @param {*} state - A state node.
 * @param {Object} userBindings - The new bindings returned by render.
 * @return {Object} The userBindings object.
 */
function checkRenderResult(userBindings, node, state) {
  checkRenderResultRecurse(userBindings, node, state);
  return userBindings;
}

/**
 * Run lifecycle functions for the component.
 * @param {Object} address -
 * @param {Object} component -
 * @param {Object} state -
 * @param {Object} diffVal -
 * @param {Object|null} lastRenderedEl - The element rendered in previously, if
 *                                       there was one.
 * @param {Object|null} el - The element to render in provided by
 *                           component.render.
 * @param {Object} stateCallers -
 * @return {Object}
 */
function updateEl(address, component, state, diffVal, lastRenderedEl, el, stateCallers, opts) {
  // the object passed to lifecycle functions
  var reducers = patchReducersWithState(address, component, stateCallers.callReducer);
  var signals = patchSignals(address, component, stateCallers.callSignal);
  var methods = patchMethods(address, component, stateCallers.callMethod, reducers, signals);
  var arg = { state: state, methods: methods, reducers: reducers, signals: signals, el: el, lastRenderedEl: lastRenderedEl };

  // warn if the el is null
  if (el === null && !(diffVal === DESTROY) && component.render !== noop) {
    throw new Error('No binding provided for component ' + component.displayName + ' at [' + address.join(', ') + '].');
  }

  if (diffVal === DESTROY) {
    // destroy
    component.willUnmount(arg);
    return { bindings: null, lastRenderedEl: lastRenderedEl };
  } else {
    // create or update
    var shouldUpdate = diffVal === CREATE || diffVal === UPDATE || el !== lastRenderedEl;

    if (diffVal === CREATE) component.willMount(arg);else if (shouldUpdate) component.willUpdate(arg);

    if (opts.verbose && shouldUpdate) {
      console.log('Rendering ' + component.displayName + ' at [' + address.join(', ') + '].');
    }

    // render
    var bindings = shouldUpdate ? checkRenderResult(component.render(arg), component.model, state) : null;
    // check result
    if (shouldUpdate && bindings === null && hasChildren(component.model)) {
      throw new Error('The render function of component ' + component.displayName + ' did not return new bindings');
    }

    // These need to be asynchronous.
    if (diffVal === CREATE) {
      defer(function () {
        return component.didMount(arg);
      });
    } else if (shouldUpdate) {
      defer(function () {
        return component.didUpdate(arg);
      });
    }

    // If the component rendered, then change lastEl.
    return { bindings: bindings, lastRenderedEl: shouldUpdate ? el : lastRenderedEl };
  }
}

/**
 * For a tree, return everything down to the first set of NODES with data for
 * leaves.
 */
function dropNodes(tree) {
  var _match3;

  return match(tree, (_match3 = {}, _match3[NODE] = function (node) {
    return node.data;
  }, _match3[OBJECT] = function (obj) {
    return mapValues(obj, dropNodes);
  }, _match3[ARRAY] = function (ar) {
    return ar.map(dropNodes);
  }, _match3[NULL] = function () {
    return null;
  }, _match3));
}

/**
 * Run create, update, and destroy for component.
 * @param {Array} address - The location of the component in the state.
 * @param {Object} node - A model or a node within a model.
 * @param {Object} diff - The diff object for this component.
 * @param {Object|null} bindings -
 * @param {Object|null} renderResult -
 * @param {Object} stateCallers -
 * @return {Object}
 */
function updateComponents(address, node, state, diff, bindings, renderResult, stateCallers, opts) {
  var _match4;

  var updateRecurse = function updateRecurse(_ref2, k) {
    var d = _ref2[0],
        s = _ref2[1];

    // TODO in updateRecurse functions where k can be null, there must be a
    // nicer way to organize things with fewer null checks
    var component = k !== null ? node.component : node;
    var newAddress = k !== null ? addressWith(address, k) : address;
    var b = k !== null ? get(bindings, k) : bindings;
    var r = k !== null ? get(renderResult, k) : renderResult;
    // Update the component. If DESTROY, then there will not be a binding.
    var res = updateEl(newAddress, component, s, d.data, get(b, 'data'), r, stateCallers, opts);
    // Fall back on old bindings.
    var nextRenderResult = res.bindings !== null ? res.bindings : dropNodes(b.children);
    var data = res.lastRenderedEl;
    // update children
    var children = updateComponents(newAddress, component.model, s, d.children, get(b, 'children'), nextRenderResult, stateCallers, opts);
    return tagType(NODE, { data: data, children: children });
  };
  var recurse = function recurse(n, k) {
    return updateComponents(addressWith(address, k), n, get(state, k), diff[k], get(bindings, k), get(renderResult, k), stateCallers, opts);
  };
  return match(node, (_match4 = {}, _match4[OBJECT_OF] = function (objOf) {
    return mapValues(zipObjects([diff, state]), updateRecurse);
  }, _match4[ARRAY_OF] = function (arOf) {
    return zipArrays([diff, state]).map(updateRecurse);
  }, _match4[COMPONENT] = function (component) {
    return updateRecurse([diff, state], null);
  }, _match4[ARRAY] = function (ar) {
    return ar.map(recurse);
  }, _match4[OBJECT] = function (obj) {
    return mapValues(obj, recurse);
  }, _match4));
}

// -------------------------------------------------------------------
// State
// -------------------------------------------------------------------

function addressWith(address, key) {
  if (key === null) {
    return address;
  } else {
    var newAddress = address.slice(0);
    newAddress.push(key);
    return newAddress;
  }
}

function addressEqual(a1, a2) {
  if (a1 === null || a2 === null || a1.length !== a2.length) return false;
  return a1.reduce(function (accum, v, i) {
    return accum && v === a2[i];
  }, true);
}

/**
 * Get the value in a tree.
 * @param {Array} address -
 * @param {Object} tree -
 * @return {*} - The value at the given address.
 */
function treeGet(address, tree) {
  return address.reduce(function (accum, val) {
    return checkType(NODE, accum) ? accum.children[val] : accum[val];
  }, tree);
}

/**
 * Set the value in a tree; immutable.
 * @param {Array} address -
 * @param {Object} tree -
 * @param {*} value - The new value to set at address.
 * @return (*) The new tree.
 */
function treeSet(address, tree, value) {
  if (address.length === 0) {
    return value;
  } else {
    var _extends3;

    var _head = head(address),
        k = _head[0],
        rest = _head[1];

    return typeof k === 'string' ? _extends({}, tree, (_extends3 = {}, _extends3[k] = treeSet(rest, treeGet([k], tree), value), _extends3)) : [].concat(tree.slice(0, k), [treeSet(rest, treeGet([k], tree), value)], tree.slice(k + 1));
  }
}

/**
 * Set the value in a tree; mutable.
 * @param {Array} address -
 * @param {Object} tree -
 * @param {*} value - The new value to set at address.
 * @return (*) The tree.
 */
function treeSetMutable(address, tree, value) {
  if (address.length === 0) {
    return value;
  } else {
    var _tail = tail(address),
        rest = _tail[0],
        _last = _tail[1];

    var parent = treeGet(rest, tree);
    if (checkType(NODE, parent)) {
      parent.children[_last] = value;
    } else {
      parent[_last] = value;
    }
    return tree;
  }
}

function makeTree(init, mutable) {
  var state = init;
  return {
    get: function get(address) {
      return treeGet(address, state);
    },
    set: function set(address, value) {
      state = mutable ? treeSetMutable(address, state, value) : treeSet(address, state, value);
    }
  };
}

/**
 * Check that the new state is valid. If not, then throw an Error.
 * @param {Object} modelNode - A model or a node of a model.
 * @param {Object} newState - The new state corresponding to modelNode.
 */
function checkState(modelNode, newState) {
  var _match5;

  if (newState === null) {
    return;
  }
  match(modelNode, (_match5 = {}, _match5[OBJECT_OF] = function (objOf) {
    if (!isObject(newState) || isArray(newState)) {
      throw new Error('Shape of the new state does not match the model. ' + 'Model: ' + objOf + '  State: ' + newState);
    } else {
      mapValues(newState, function (s) {
        return checkState(modelNode.component.model, s);
      });
    }
  }, _match5[ARRAY_OF] = function (arOf) {
    if (!isArray(newState)) {
      throw new Error('Shape of the new state does not match the model.' + 'Model: ' + arOf + '  State: ' + newState);
    } else {
      newState.map(function (s) {
        return checkState(modelNode.component.model, s);
      });
    }
  }, _match5[COMPONENT] = function (component) {
    checkState(modelNode.model, newState);
  }, _match5[ARRAY] = function (ar) {
    if (!isArray(newState)) {
      throw new Error('Shape of the new state does not match the model.' + 'Model: ' + ar + '  State: ' + newState);
    } else {
      ar.map(function (a, i) {
        return checkState(a, get(newState, i));
      });
    }
  }, _match5[OBJECT] = function (obj) {
    if (!isObject(newState) || isArray(newState)) {
      throw new Error('Shape of the new state does not match the model. ' + 'Model: ' + obj + '  State: ' + newState);
    } else {
      mapValues(obj, function (o, k) {
        return checkState(o, get(newState, k));
      });
    }
  }, _match5));
}

function computeDiffValue(state, lastState, key, isValidFn, shouldUpdate, address, triggeringAddress) {
  var stateValid = isValidFn(state, key);
  var lastStateValid = isValidFn(lastState, key);
  if (stateValid && !lastStateValid) {
    return CREATE;
  } else if (stateValid && lastStateValid) {
    var same = key === null ? state !== lastState : state[key] !== lastState[key];
    var componentTriggeredUpdate = addressEqual(address, triggeringAddress);
    if (same && shouldUpdate({ state: state, lastState: lastState, componentTriggeredUpdate: componentTriggeredUpdate })) {
      return UPDATE;
    } else {
      return null;
    }
  } else if (!stateValid && lastStateValid) {
    return DESTROY;
  } else {
    return null;
  }
}

/**
 * Compute the full diff tree for the model node. Calls shouldUpdate.
 */
function diffWithModel(modelNode, state, lastState, address, triggeringAddress) {
  var _match6;

  return match(modelNode, (_match6 = {}, _match6[OBJECT_OF] = function (objOf) {
    var isValidFn = function isValidFn(obj, k) {
      return isObject(obj) && k in obj && obj[k] !== null;
    };
    var l = Object.assign({}, state || {}, lastState || {});
    return mapValues(l, function (_, k) {
      var data = computeDiffValue(state, lastState, k, isValidFn, objOf.component.shouldUpdate, addressWith(address, k), triggeringAddress);
      var children = diffWithModel(objOf.component.model, get(state, k), get(lastState, k), addressWith(address, k), triggeringAddress);
      return tagType(NODE, { data: data, children: children });
    });
  }, _match6[ARRAY_OF] = function (arOf) {
    var isValidFn = function isValidFn(obj, i) {
      return isArray(obj) && i < obj.length && obj[i] !== null;
    };
    var longest = Math.max(isArray(state) ? state.length : 0, isArray(lastState) ? lastState.length : 0);
    var l = Array.apply(null, { length: longest });
    return l.map(function (_, i) {
      var data = computeDiffValue(state, lastState, i, isValidFn, arOf.component.shouldUpdate, addressWith(address, i), triggeringAddress);
      var children = diffWithModel(arOf.component.model, get(state, i), get(lastState, i), addressWith(address, i), triggeringAddress);
      return tagType(NODE, { data: data, children: children });
    });
  }, _match6[COMPONENT] = function (component) {
    var isValidFn = function isValidFn(obj, _) {
      return obj !== null;
    };
    var data = computeDiffValue(state, lastState, null, isValidFn, component.shouldUpdate, address, triggeringAddress);
    var children = diffWithModel(component.model, state || null, lastState || null, address, triggeringAddress);
    return tagType(NODE, { data: data, children: children });
  }, _match6[ARRAY] = function (ar) {
    return ar.map(function (n, i) {
      return diffWithModel(n, get(state, i), get(lastState, i), addressWith(address, i), triggeringAddress);
    });
  }, _match6[OBJECT] = function (obj) {
    return mapValues(obj, function (n, k) {
      return diffWithModel(n, get(state, k), get(lastState, k), addressWith(address, k), triggeringAddress);
    });
  }, _match6));
}

/**
 * For an array of minSignals and minUpdate trees, return the minimal trees that
 * represent the whole array.
 */
function singleOrAll(modelNode, address, minTreeAr) {
  var getMin = function getMin(indices) {
    if (indices.length === 0) {
      // If all elements in the array are null, return null.
      return null;
    } else if (nonNullIndices.signals.length === 1) {
      // If there is a single value, return that tree, with an updated address.
      return {
        minSignals: {
          diff: minTreeAr.map(function (a) {
            return a.minSignals.diff;
          }),
          address: address,
          modelNode: modelNode
        },
        minUpdate: {
          diff: minTreeAr.map(function (a) {
            return a.minUpdate.diff;
          }),
          address: address,
          modelNode: modelNode
        }
      };
    } else {
      // Otherwise, return full trees from this level.
      return {
        minSignals: {
          diff: minTreeAr.map(function (a) {
            return a.minSignals.diff;
          }),
          address: address,
          modelNode: modelNode
        },
        minUpdate: {
          diff: minTreeAr.map(function (a) {
            return a.minUpdate.diff;
          }),
          address: address,
          modelNode: modelNode
        }
      };
    }
  };
  // Get the indices where the signal and update trees are not null.
  var nonNullIndices = minTreeAr.reduce(function (accum, val, i) {
    return {
      signals: val.minSignals !== null ? [].concat(accum.signals, [i]) : accum.signals,
      update: val.minUpdate !== null ? [].concat(accum.update, [i]) : accum.update
    };
  }, { signals: [], update: [] });
  // For each set of indices, test the diffs with these tests to get a minimum
  // tree.
  var minSignals = getMin(nonNullIndices.signals);
  var minUpdate = getMin(nonNullIndices.update);
  return { minSignals: minSignals, minUpdate: minUpdate };
}

/**
 * 1. Run shouldUpdate for every component in the tree.
 * 2. Return the information about the minimal tree to update with
 *    updateComponents (whenever shouldUpdate is true) as minUpdate.
 * 3. Return the information about the minimal tree to update with
 *    mergeSignals (whenever nodes are added or deleted) as minSignals.
 *
 * @param {Object} modelNode - A model or a node of a model.
 * @param {Object} state - The new state corresponding to modelNode.
 * @param {Object|null} lastState - The old state corresponding to modelNode.
 * @param {Array} address -
 * @param {Array} triggeringAddress -
 * @returns {Object} An object with the attributes minSignals and
 *                   minUpdate. Each represents a minimal tree necessary for the
 *                   appropriate update function and has the attributes diff,
 *                   modelNode, and address.
 */
function diffWithModelMin(modelNode, state, lastState, address, triggeringAddress) {
  // 1. calculate whole diff tree
  var diff = diffWithModel(modelNode, state, lastState, address, triggeringAddress);
  // 2. trim the tree for the two needs
  return {
    minSignals: {
      diff: diff,
      address: address,
      modelNode: modelNode
    },
    minUpdate: {
      diff: diff,
      address: address,
      modelNode: modelNode
    }
  };
}

// -------------------------------------------------------------------
// Signals
// -------------------------------------------------------------------

/**
 * Make a signal.
 * @return {Object} A signal with attributes `on` and `call`.
 */
function makeSignal() {
  var res = { _onFns: [] };
  res.on = function (fn) {
    if (!isFunction(fn)) {
      throw new Error('First argument to "on" must be a function');
    }
    res._onFns = [].concat(res._onFns, [fn]);
  };
  res.call = function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return res._onFns.map(function (fn) {
      return fn.apply(undefined, args);
    });
  };
  return res;
}

/**
 * Create an object that with `on/onEach` and `call` attributes.
 * @param {Boolean} isCollection -
 * @return {Object}
 */
function makeOneSignalAPI(isCollection) {
  // make a `_callFn` function that will be replaced later and is the target of
  // `call`
  var res = { _callFns: [] };
  // call will run all functions in `_callFns`
  res.call = function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    if (args.length > 1 || !isObject(args[0])) {
      throw new Error('Call only accepts a single object as argument.');
    }
    res._callFns.map(function (_ref3) {
      var fn = _ref3.fn;
      return fn(args[0]);
    });
  };
  // store callbacks passed with `on` or `onEach`
  res._onFns = [];
  var onName = isCollection ? 'onEach' : 'on';
  res[onName] = function (fn) {
    if (!isFunction(fn)) {
      throw new Error('Argument to "' + onName + '" must be a function');
    }
    res._onFns.push(function (index) {
      return function () {
        if (arguments.length > 1 || !isObject(arguments.length <= 0 ? undefined : arguments[0])) {
          throw new Error('On function only accepts a single object as argument.');
        }
        var argObject = typeof index === 'string' ? _extends({ k: index }, arguments.length <= 0 ? undefined : arguments[0]) : typeof index === 'number' ? _extends({ i: index }, arguments.length <= 0 ? undefined : arguments[0]) : arguments.length <= 0 ? undefined : arguments[0];
        fn(argObject);
      };
    });
  };
  return res;
}

/**
 * Implement the signals API.
 */
function makeSignalsAPI(signalNames, isCollection) {
  return fromPairs(signalNames.map(function (name) {
    return [name, makeOneSignalAPI(isCollection)];
  }));
}

/**
 * Implement the childSignals API.
 */
function makeChildSignalsAPI(model) {
  var _match7;

  return match(model, (_match7 = {}, _match7[OBJECT_OF] = function (node) {
    return makeSignalsAPI(node.component.signalNames, true);
  }, _match7[ARRAY_OF] = function (node) {
    return makeSignalsAPI(node.component.signalNames, true);
  }, _match7[COMPONENT] = function (node) {
    return makeSignalsAPI(node.signalNames, false);
  }, _match7[ARRAY] = function (ar) {
    return ar.map(makeChildSignalsAPI).filter(notNull);
  }, _match7[OBJECT] = function (obj) {
    return filterValues(mapValues(obj, makeChildSignalsAPI), notNull);
  }, _match7), constant(null));
}

/**
 * Reduce the direct children of the tree.
 * @param {Object} node - A node in a tree.
 * @param {Function} fn - Function with arguments (accum, object).
 * @param {*} init - An initial value.
 * @param {Array} address - The local address.
 * @return {*}
 */
function reduceChildren(node, fn, init) {
  var _match8;

  var address = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

  return match(node, (_match8 = {}, _match8[NODE] = function (node) {
    return fn(init, node.data, address);
  }, _match8[ARRAY] = function (ar) {
    return ar.reduce(function (accum, n, k) {
      return reduceChildren(n, fn, accum, addressWith(address, k));
    }, init);
  }, _match8[OBJECT] = function (obj) {
    return reduceValues(obj, function (accum, n, k) {
      return reduceChildren(n, fn, accum, addressWith(address, k));
    }, init);
  }, _match8), constant(init));
}

/**
 * Run signalSetup with the component.
 * @param {Object} component -
 * @param {Array} address -
 * @param {Object} stateCallers -
 * @return {Object} Object with keys signalsAPI and childSignalsAPI.
 */
function runSignalSetup(component, address, stateCallers) {
  var signalsAPI = makeSignalsAPI(component.signalNames, false);
  var childSignalsAPI = makeChildSignalsAPI(component.model);
  var reducers = patchReducersWithState(address, component, stateCallers.callReducer);
  var signals = patchSignals(address, component, stateCallers.callSignal);
  var methods = patchMethods(address, component, stateCallers.callMethod, reducers, signals);
  // cannot call signalSetup any earlier because it needs a reference to
  // `methods`, which must know the address
  component.signalSetup({
    methods: methods,
    reducers: reducers,
    signals: signalsAPI,
    childSignals: childSignalsAPI
  });
  return { signalsAPI: signalsAPI, childSignalsAPI: childSignalsAPI };
}

/**
 * Merge a signals object with signal callbacks from signalSetup.
 * @param {Object} node - A model node.
 * @param {Array} address - The address.
 * @param {Object} diffNode - A node in the diff tree.
 * @param {Object|null} signalNode - A node in the existing signals tree.
 * @param {Object} stateCallers - The object with 3 functions to modify global
 *                                state.
 * @param {Object|null} upChild - The childSignalsAPI object for the parent
 *                                Component.
 * @param {Array|null} upAddress - A local address specifying the location
 *                                 relative to the parent Component.
 * @return {Object} The new signals tree.
 */
function mergeSignals(node, address, diffNode, signalNode, stateCallers) {
  var _match9;

  var upChild = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : null;
  var upAddress = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : null;

  var updateRecurse = function updateRecurse(_ref4, k) {
    var d = _ref4[0],
        s = _ref4[1];

    var component = k !== null ? node.component : node;
    var newAddress = k !== null ? addressWith(address, k) : address;
    var diffVal = d.data;
    if (diffVal === CREATE) {
      var _ret2 = function () {
        // For create, apply the callbacks
        var _runSignalSetup = runSignalSetup(component, newAddress, stateCallers),
            signalsAPI = _runSignalSetup.signalsAPI,
            childSignalsAPI = _runSignalSetup.childSignalsAPI;

        var newUpAddress = upAddress === null ? null : addressWith(upAddress, k);
        var signals = mapValues(zipObjects([signalsAPI, upChild]), function (_ref5, key) {
          var callbackObj = _ref5[0],
              upCallbackObj = _ref5[1];

          var signal = makeSignal();

          // For each callback, add each onFn to the signal,
          // and set the callFn to the signal dispatch. Only
          // on, not onEach, so execute the fn with no
          // argument.
          callbackObj._onFns.map(function (fn) {
            return signal.on(fn());
          });
          callbackObj._callFns = [{ fn: signal.call, address: null }];

          // For the childSignalCallbacks from the parent
          if (upCallbackObj !== null) {
            upCallbackObj._onFns.map(function (fn) {
              return signal.on(fn(k));
            });
            upCallbackObj._callFns = [].concat(upCallbackObj._callFns, [{ fn: signal.call, address: newUpAddress }]);
          }

          return signal;
        });
        var data = { signals: signals, signalsAPI: signalsAPI, childSignalsAPI: childSignalsAPI };

        // loop through the children of signals and node
        var children = mergeSignals(component.model, newAddress, d.children, get(s, 'children'), stateCallers, childSignalsAPI, []);

        return {
          v: tagType(NODE, { data: data, children: children })
        };
      }();

      if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
    } else if (diffVal === DESTROY) {
      // In the case of destroy, this leaf in the signals object will be null.
      return null;
    } else {
      // update
      var _reduceChildren = reduceChildren(d.children, function (accum, diffVal, address) {
        var hasCreated = accum.hasCreated || diffVal === CREATE;
        var destroyed = diffVal === DESTROY ? [].concat(accum.destroyed, [address]) : accum.destroyed;
        return { hasCreated: hasCreated, destroyed: destroyed };
      }, { hasCreated: false, destroyed: [] }),
          hasCreated = _reduceChildren.hasCreated,
          destroyed = _reduceChildren.destroyed;

      // if there are deleted children, delete references to them


      destroyed.map(function (childAddress) {
        // get the right child within childSignalsAPI
        var childSignalsAPINode = childAddress.reduce(function (accum, k, i) {
          if (k in accum) {
            return accum[k];
          } else if (i === childAddress.length - 1) {
            return accum;
          } else {
            throw new Error('Bad address ' + childAddress + ' for object ' + s.data.childSignalsAPI);
          }
        }, s.data.childSignalsAPI);
        mapValues(childSignalsAPINode, function (obj) {
          // remove the matching callFns
          obj._callFns = obj._callFns.filter(function (_ref6) {
            var address = _ref6.address;

            return !addressEqual(address, childAddress);
          });
        });
      });

      var newUpChild = hasCreated ? s.data.childSignalsAPI : null;
      var _newUpAddress = hasCreated ? [] : null;
      var _children = mergeSignals(component.model, newAddress, d.children, get(s, 'children'), stateCallers, newUpChild, _newUpAddress);
      return tagType(NODE, { data: get(s, 'data'), children: _children });
    }
  };

  var recurse = function recurse(_ref7, k) {
    var n = _ref7[0],
        d = _ref7[1],
        s = _ref7[2],
        u = _ref7[3];

    var newAddress = addressWith(address, k);
    var newUpAddress = upAddress === null ? null : addressWith(upAddress, k);
    return mergeSignals(n, newAddress, d, s, stateCallers, u, newUpAddress);
  };

  return match(node, (_match9 = {}, _match9[OBJECT_OF] = function (objOf) {
    return filterValues(mapValues(zipObjects([diffNode, signalNode]), updateRecurse), notNull);
  }, _match9[ARRAY_OF] = function (arOf) {
    return zipArrays([diffNode, signalNode]).map(updateRecurse).filter(notNull);
  }, _match9[COMPONENT] = function (component) {
    return updateRecurse([diffNode, signalNode], null);
  }, _match9[ARRAY] = function (ar) {
    return zipArrays([ar, diffNode, signalNode, upChild]).map(recurse);
  }, _match9[OBJECT] = function (obj) {
    return mapValues(zipObjects([obj, diffNode, signalNode, upChild]), recurse);
  }, _match9), constant(null));
}

// -------------------------------------------------------------------
// Component & run functions
// -------------------------------------------------------------------

/**
 * Create an object representing many instances of this component, for use in a
 * tinier model.
 * @param {Object} component - Tinier component.
 * @return {Object}
 */
function objectOf(component) {
  return tagType(OBJECT_OF, { component: component });
}

/**
 * Create an array representing many instances of this component, for use in a
 * tinier model.
 * @param {Object} component - Tinier component.
 * @return {Object}
 */
function arrayOf(component) {
  return tagType(ARRAY_OF, { component: component });
}

function defaultShouldUpdate(_ref8) {
  var state = _ref8.state,
      lastState = _ref8.lastState;

  return state !== lastState;
}

function checkInputs(options, defaults) {
  mapValues(options, function (_, k) {
    if (!(k in defaults)) {
      console.error('Unexpected argument ' + k);
    }
  });
}

function patchInitNoArg(init) {
  return function () {
    if (arguments.length === 0) {
      return init({});
    } else if (arguments.length > 1 || !isObject(arguments.length <= 0 ? undefined : arguments[0])) {
      throw new Error('Reducers can only take 1 or 0 arguments, and the ' + 'argument should be an object.');
    } else {
      return init(arguments.length <= 0 ? undefined : arguments[0]);
    }
  };
}

function patchReducersOneArg(reducers) {
  return mapValues(reducers, function (reducer, name) {
    return function () {
      if (arguments.length !== 1 || !isObject(arguments.length <= 0 ? undefined : arguments[0])) {
        throw new Error('Reducers can only take 1 arguments, and the ' + 'argument should be an object.');
      } else if (!('state' in (arguments.length <= 0 ? undefined : arguments[0]))) {
        throw new Error('The argument to the reducer must have a "state" ' + 'attribute.');
      } else {
        return reducer(arguments.length <= 0 ? undefined : arguments[0]);
      }
    };
  });
}

/**
 * Create a tinier component.
 * @param {Object} componentArgs - Functions defining the Tinier component.
 * @param {str} componentArgs.displayName - A name for the component.
 * @param {[str]} componentArgs.signals - An array of signal names.
 * @param {Object} componentArgs.model - The model object.
 * @param {Function} componentArgs.init - A function to initialize the state.
 * @param {Object} componentArgs.reducers -
 * @param {Object} componentArgs.methods -
 * @param {Function} componentArgs.willMount -
 * @param {Function} componentArgs.didMount -
 * @param {Function} componentArgs.shouldUpdate - Return true if the component
 *                                                should update, false if it
 *                                                should not, or null to use to
 *                                                default behavior (update when
 *                                                state changes).
 * @param {Function} componentArgs.willUpdate -
 * @param {Function} componentArgs.didUpdate -
 * @param {Function} componentArgs.willUnmount -
 * @param {Function} componentArgs.render -
 * @returns {Object} A tinier component.
 */
function createComponent() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  // default attributes
  var defaults = {
    displayName: '',
    signalNames: [],
    signalSetup: noop,
    model: {},
    init: constant({}),
    reducers: {},
    methods: {},
    willMount: noop,
    didMount: noop,
    shouldUpdate: defaultShouldUpdate,
    willUpdate: noop,
    didUpdate: noop,
    willUnmount: noop,
    render: noop
  };
  // check inputs
  checkInputs(options, defaults);

  if ('init' in options) {
    options.init = patchInitNoArg(options.init);
  }

  if ('reducers' in options) {
    options.reducersRaw = options.reducers;
    options.reducers = patchReducersOneArg(options.reducers);
  }

  // check model
  if (options.model && checkType(COMPONENT, options.model)) {
    throw new Error('The model cannot be another Component. The top level of ' + 'the model should be an array or an object literal');
  }
  // set defaults & tag
  return tagType(COMPONENT, _extends({}, defaults, options));
}

function patchReducersWithState(address, component, callReducer) {
  return mapValues(component.reducersRaw, function (reducer, name) {
    return function () {
      if (arguments.length === 0) {
        callReducer(address, component, reducer, {}, name);
      } else if (arguments.length > 1 || !isObject(arguments.length <= 0 ? undefined : arguments[0])) {
        throw new Error('Reducers can only take 1 or 0 arguments, and the ' + 'argument should be an object.');
      } else {
        callReducer(address, component, reducer, arguments.length <= 0 ? undefined : arguments[0], name);
      }
    };
  });
}

function patchSignals(address, component, callSignal) {
  return fromPairs(component.signalNames.map(function (signalName) {
    return [signalName, { call: function call(arg) {
        return callSignal(address, signalName, arg);
      } }];
  }));
}

/**
 * Return an object of functions that call the methods with component-specific
 * arguments.
 */
function patchMethods(address, component, callMethod, reducers, signals) {
  var methods = mapValues(component.methods, function (method) {
    return function (arg) {
      if (typeof Event !== 'undefined' && arg instanceof Event) {
        callMethod(address, method, signals, methods, reducers, this, arg, {});
      } else {
        callMethod(address, method, signals, methods, reducers, null, null, arg);
      }
    };
  });
  return methods;
}

function makeCallMethod(stateTree, opts) {
  /**
   * Call a method on the local stateTree
   * @param address
   * @param method
   * @param signals
   * @param methods - Patched method functions.
   * @param reducers - Patched reducer functions.
   * @param target - The value of this in the called function.
   * @param event - The event at the time of the function call.
   * @param arg - An argument object.
   */
  return function (address, method, signals, methods, reducers, target, event, arg) {
    // check for uninitialized stateTree
    if (stateTree.get([]) === null) {
      throw new Error('Cannot call method before the app is initialized (e.g. ' + 'in signalSetup).');
    }
    // get the local state
    var localState = stateTree.get(address);
    // run the method
    method(_extends({ state: localState, signals: signals, methods: methods, reducers: reducers, target: target, event: event
    }, arg));
  };
}

/**
 * Return a callSignal function.
 */
function makeCallSignal(signals, opts) {
  return function (address, signalName, arg) {
    if (opts.verbose) {
      console.log('Called signal ' + signalName + ' at [' + address.join(', ') + '].');
    }
    signals.get(address).data.signals[signalName].call(arg);
  };
}

/**
 * Return a new callReducer function.
 * @param {Object} topComponent - The top-level component.
 * @param {Object} stateTree - The global stateTree.
 * @param {Object} bindingTree - The global bindingTree.
 * @param {Object} signalTree - The global signalTree.
 * @param {Object} stateCallers - An object with functions callMethod,
 *                                callSignal, and callReducer.
 * @param {Object} opts - Options from `run`.
 * @returns {Function} - Call a reducer on the local state
 *   @param {Array} address - A location, as an array of keys (strings and
 *                            integers).
 *   @param {Object} triggeringComponent -
 *   @param {Function} reducer - A reducer.
 *   @param {Object} arg - An argument object.
 *   @param {String} name - The name of the reducer (for logging).
 */
function makeCallReducer(topComponent, stateTree, bindingTree, signalTree, stateCallers, opts) {
  return function (address, triggeringComponent, reducer, arg, name) {
    if (!isFunction(reducer)) {
      throw new Error('Reducer ' + name + ' is not a function');
    }
    // Run the reducer, and optionally log the result.
    var localState = stateTree.get(address);
    var newLocalState = reducer(_extends({}, arg, { state: localState }));
    if (opts.verbose) {
      console.log('Called reducer ' + name + ' for ' + triggeringComponent.displayName + ' at [' + address.join(', ') + '].');
      console.log(localState);
      console.log(newLocalState);
    }

    // Check that the new state is valid. If not, throw an Error, and the new
    // state will be thrown out.
    checkState(triggeringComponent.model, newLocalState);

    // Set the state with immutable objects and arrays. A reference to oldState
    // will used for diffing.
    var lastState = stateTree.get([]);
    stateTree.set(address, newLocalState);

    // Run diffWithModelMin, which will do a few things:
    // 1. Run shouldUpdate for every component in the tree.
    // 2. Return the information about the minimal tree to update with
    //    updateComponents (whenever shouldUpdate is true) as minUpdate.
    // 3. Return the information about the minimal tree to update with
    //    mergeSignals (whenever nodes are added or deleted) as minSignals.
    // The output objects have the attributes diff, modelNode, and address.
    // TODO might be best to go back to returning just one full diff here

    var _diffWithModelMin = diffWithModelMin(topComponent, stateTree.get([]), lastState, [], address),
        minSignals = _diffWithModelMin.minSignals,
        minUpdate = _diffWithModelMin.minUpdate;

    // Update the signals.


    var localSignals = signalTree.get(minSignals.address);
    var newSignals = mergeSignals(minSignals.modelNode, minSignals.address, minSignals.diff, localSignals, stateCallers);
    signalTree.set(minSignals.address, newSignals);

    // Update the components.
    var minUpdateBindings = bindingTree.get(minUpdate.address);
    var minUpdateEl = minUpdateBindings.data;
    var minUpdateState = stateTree.get(minUpdate.address);
    var newBindings = updateComponents(minUpdate.address, minUpdate.modelNode, minUpdateState, minUpdate.diff, minUpdateBindings, minUpdateEl, stateCallers, opts);
    bindingTree.set(minUpdate.address, newBindings);
  };
}

/**
 * Return an object with functions callMethod, callSignal, and callReducer.
 * @param {Object} component - The top-level component.
 * @param {Object} stateTree - The global stateTree.
 * @param {Object} bindingTree - The global bindings.
 * @param {Object} signalTree - The global signalTree.
 * @return {Object} An object with functions callMethod, callSignal, and
 *                  callReducer.
 */
function makeStateCallers(component, stateTree, bindingTree, signalTree, opts) {
  var stateCallers = {};
  stateCallers.callMethod = makeCallMethod(stateTree, opts);
  stateCallers.callSignal = makeCallSignal(signalTree, opts);
  stateCallers.callReducer = makeCallReducer(component, stateTree, bindingTree, signalTree, stateCallers, opts);
  return stateCallers;
}

/**
 * Run a tinier component.
 * @param {Object} component - A tinier component.
 * @param {*} appEl - An element to pass to the component's create, update, and
 *                    destroy methods.
 * @param {Object|null} initialState - The initial state. If null, then init()
 *                                     will be called to initialize the state.
 * @return {Object} The API functions, incuding getState, signals, and methods.
 */
function run(component, appEl) {
  var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  // Create variables that will store the state for the whole lifetime of the
  // application. Similar to the redux model.
  var stateTree = makeTree(null, false);
  var topBinding = tagType(NODE, { data: appEl, children: null });
  var bindingTree = makeTree(topBinding, true);
  var signalTree = makeTree(null, true);

  // functions that access state, signals, and bindings
  var stateCallers = makeStateCallers(component, stateTree, bindingTree, signalTree, opts);

  // make sure initial state is valid
  // TODO LEFT OFF ... does this work?
  // Q: Does the state for a child component need to be defined? Are we checking
  // all the way down the line?
  var initialState = 'initialState' in opts ? opts.initialState : component.init();

  // first draw
  var setStateReducer = function setStateReducer(_ref9) {
    var newState = _ref9.newState;
    return newState;
  };
  var setState = function setState(newState) {
    return stateCallers.callReducer([], component, setStateReducer, { newState: newState }, 'setState');
  };
  setState(initialState);

  // return API
  var getState = function getState() {
    return stateTree.get([]);
  };
  // TODO check state
  var setStateNoRender = function setStateNoRender(newState) {
    return stateTree.set([], newState);
  };
  var reducers = patchReducersWithState([], component, stateCallers.callReducer);
  var signalsCall = patchSignals([], component, stateCallers.callSignal);
  var methods = patchMethods([], component, stateCallers.callMethod, reducers, signalsCall);
  // if state is null, then data will be null
  var signals = get(signalTree.get([]).data, 'signals');

  return { setState: setState, setStateNoRender: setStateNoRender, getState: getState, reducers: reducers, methods: methods, signals: signals };
}

// -------------------------------------------------------------------
// DOM
// -------------------------------------------------------------------

// constants
var BINDING = exports.BINDING = '@TINIER_BINDING';
var ELEMENT = exports.ELEMENT = '@TINIER_ELEMENT';
var LISTENER_OBJECT = '@TINIER_LISTENERS';

function reverseObject(obj) {
  var newObj = {};
  for (var k in obj) {
    newObj[obj[k]] = k;
  }
  return newObj;
}

// some attribute renaming as seen in React
var ATTRIBUTE_RENAME = {};
var ATTRIBUTE_RENAME_REV = reverseObject(ATTRIBUTE_RENAME);
var ATTRIBUTE_APPLY = {
  checked: function checked(el, name) {
    var val = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    if (name !== 'input') {
      throw new Error('"checked" attribute is only supported on input elements.');
    }
    el.checked = val;
  },
  value: function value(el, name) {
    var val = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    if (['input', 'textarea'].indexOf(name) === -1) {
      throw new Error('"value" attribute is only supported on input and ' + 'textarea elements.');
    }
    el.value = val;
  }
};

// namespace management inspired by of D3.js, Mike Bostock, BSD license
var NAMESPACES = {
  svg: 'http://www.w3.org/2000/svg',
  xhtml: 'http://www.w3.org/1999/xhtml',
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xmlns: 'http://www.w3.org/2000/xmlns/'
};

/**
 * Turn an array of objects into a new object of objects where the keys are
 * given by the value of `key` in each child object.
 * @param {[Object]} arr - The array of objects.
 * @param {String} key - The key to look for.
 */
function keyBy(arr, key) {
  var obj = {};
  arr.map(function (x) {
    return obj[x[key]] = x;
  });
  return obj;
}

/**
 *
 */
function addressToObj(address, val) {
  // If address is []
  if (isUndefined(address[0])) {
    return val;
  }
  var f = address[0];
  if (isString(f)) {
    var _ref10;

    return _ref10 = {}, _ref10[f] = addressToObj(address.slice(1), val), _ref10;
  } else {
    var ar = Array(f + 1);
    ar[f] = addressToObj(address.slice(1), val);
    return ar;
  }
}

function objectForBindingsArray(bindings) {
  // Check arrays and find longest internal array.
  var longest = 0;
  for (var j = 0, l = bindings.length; j < l; j++) {
    var binding = bindings[j];
    if (!isArray(binding)) {
      throw Error('Incompatible bindings: mix of types');
    }
    var len = binding.length;
    if (len > longest) {
      longest = len;
    }
  }
  var acc = [];
  for (var i = 0; i < longest; i++) {
    for (var _j = 0, _l = bindings.length; _j < _l; _j++) {
      var _binding = bindings[_j];
      if (_binding[i] != null) {
        // not null or undefined
        if (acc[i] != null) {
          // not null or undefined
          acc[i] = objectForBindings([_binding[i], acc[i]]);
        } else {
          acc[i] = _binding[i];
        }
      }
    }
  }
  return acc;
}

function objectForBindingsObject(bindings) {
  return bindings.reduce(function (acc, binding) {
    if (isArray(binding)) throw Error('Incompatible bindings: mix of types');
    for (var k in binding) {
      if (binding[k]) {
        if (acc[k]) {
          acc[k] = objectForBindings([binding[k], acc[k]]);
        } else {
          acc[k] = binding[k];
        }
      }
    }
    return acc;
  }, {});
}

function objectForBindings(bindings) {
  return isArray(bindings[0]) ? objectForBindingsArray(bindings) : objectForBindingsObject(bindings);
}

// Make sure default is null so undefined type constant do not match
var isTinierBinding = function isTinierBinding(obj) {
  return checkType(BINDING, obj);
};
var isTinierElement = function isTinierElement(obj) {
  return checkType(ELEMENT, obj);
};

/**
 * Returns true if it is a DOM element.
 * http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
 */
function isElement(o) {
  return o && (typeof o === 'undefined' ? 'undefined' : _typeof(o)) === 'object' && o !== null && o.nodeType === 1 && typeof o.nodeName === 'string';
}

/**
 * Returns true if it is a DOM text element.
 */
function isText(o) {
  return o && (typeof o === 'undefined' ? 'undefined' : _typeof(o)) === 'object' && o !== null && o.nodeType === 3 && typeof o.nodeName === 'string';
}

/**
 * Create a new TinierDOM element.
 * @param {String} tagName - The name for the element.
 * @param {Object|null} attributesIn - The attributes. Note that JSX will pass
 *                                     null in when there are no attributes. In
 *                                     the resulting object, this will be an
 *                                     empty object {}.
 * @param {Object[]|Object|String} ...children - A single binding or a mix of
 *                                               elements and strings.
 * @return {Object} A TinierDOM element.
 */
function createElement(tagName, attributesIn) {
  for (var _len3 = arguments.length, children = Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
    children[_key3 - 2] = arguments[_key3];
  }

  var attributes = attributesIn == null ? {} : attributesIn;
  return tagType(ELEMENT, { tagName: tagName, attributes: attributes, children: children });
}

/**
 * Create a new TinierDOM binding.
 * @param {Array|String|Number} addressIn - An address array, or single key or
 *                                          index.
 * @return {Object} A TinierDOM binding.
 */
function bind(addressIn) {
  var address = isArray(addressIn) ? addressIn : [addressIn];
  return tagType(BINDING, { address: address });
}

function explicitNamespace(name) {
  var i = name.indexOf(':');
  if (i !== -1) {
    var prefix = name.slice(0, i);
    if (prefix in NAMESPACES) {
      // for xmlns, treat the whole name (e.g. xmlns:xlink) as the name
      var newName = prefix === 'xmlns' ? name : name.slice(i + 1);
      return { name: newName, explicit: NAMESPACES[prefix] };
    } else {
      return { name: name, explicit: null };
    }
  } else {
    return { name: name, explicit: null };
  }
}

/**
 * Create a DOM element, inheriting namespace or choosing one based on tag.
 * @param {Object} tinierEl - A TinierDOM element.
 * @param {Object} parent - The parent el.
 * @return {Object} The DOM element.
 */
function createDOMElement(tinierEl, parent) {
  var tag = tinierEl.tagName;

  var _explicitNamespace = explicitNamespace(tag),
      name = _explicitNamespace.name,
      explicit = _explicitNamespace.explicit;

  var ns = explicit !== null ? explicit : tag in NAMESPACES ? NAMESPACES[tag] : parent.namespaceURI;
  var el = ns === NAMESPACES.xhtml ? document.createElement(name) : document.createElementNS(ns, name);
  return updateDOMElement(el, tinierEl);
}

function getStyles(cssText) {
  var reg = /([^:; ]+):/g;
  var res = [];
  var ar = void 0;
  while ((ar = reg.exec(cssText)) !== null) {
    res.push(ar[1]);
  }
  return res;
}

function toCamelCase(name) {
  return name
  // Uppercase the first character in each group immediately following a dash
  .replace(/-(.)/g, function (m) {
    return m.toUpperCase();
  })
  // Remove dashes
  .replace(/-/g, '');
}

function stripOn(name) {
  return name.slice(2).toLowerCase();
}

function setAttributeCheckBool(namespace, el, name, val) {
  // set boolean appropriately
  var valToSet = val === true ? name : val;
  if (namespace === NAMESPACES.xhtml) {
    el.setAttribute(name, valToSet);
  } else {
    el.setAttributeNS(namespace, name, valToSet);
  }
}

/**
 * Update the DOM element to match a TinierDOM element.
 * @param {Element} el - An existing DOM element.
 * @param {Object} tinierEl - A TinierDOM element.
 */
function updateDOMElement(el, tinierEl) {
  var thenFn = null;
  var parentNamespace = el.namespaceURI;

  // remove event listeners first, because they cannot simply be replaced
  if (el.hasOwnProperty(LISTENER_OBJECT)) {
    mapValues(el[LISTENER_OBJECT], function (onFn, name) {
      el.removeEventListener(name, onFn);
    });
    delete el[LISTENER_OBJECT];
  }

  // Update the attributes.
  // TODO is it faster to check first, or set first?
  mapValues(tinierEl.attributes, function (v, k) {
    if (k === 'id') {
      // ID is set directly
      el.id = v;
    } else if (k === 'style' && !isString(v)) {
      // For a style object. For a style string, use setAttribute below.
      mapValues(v, function (sv, sk) {
        el.style.setProperty(sk, sv);
      });
    } else if (k.indexOf('on') === 0) {
      // Special handling for listeners
      if (!el.hasOwnProperty(LISTENER_OBJECT)) {
        el[LISTENER_OBJECT] = {};
      }
      // allow null
      if (v !== null) {
        var name = stripOn(k);
        if (!isFunction(v) && v !== null) {
          throw new Error(v + ' is not a function.');
        }
        el[LISTENER_OBJECT][name] = v;
        el.addEventListener(name, v);
      }
    } else if (k in ATTRIBUTE_RENAME) {
      // By default, set the attribute.
      var _explicitNamespace2 = explicitNamespace(k),
          _name = _explicitNamespace2.name,
          explicit = _explicitNamespace2.explicit;

      setAttributeCheckBool(explicit !== null ? explicit : parentNamespace, el, ATTRIBUTE_RENAME[explicit], v);
    } else if (k in ATTRIBUTE_APPLY) {
      ATTRIBUTE_APPLY[k](el, tinierEl.tagName, v);
    } else if (k === 'then') {
      if (v !== null) {
        if (!isFunction(v)) {
          throw new Error(v + ' is not a function or null.');
        }
        thenFn = v;
      }
    } else {
      // By default, set the attribute.
      var _explicitNamespace3 = explicitNamespace(k),
          _name2 = _explicitNamespace3.name,
          _explicit = _explicitNamespace3.explicit;

      setAttributeCheckBool(_explicit !== null ? _explicit : parentNamespace, el, _name2, v);
    }
  });
  // Delete attributes if not provided. First, loop through this attributes
  // object to get a nice array.
  var attributeNames = [];
  for (var i = 0, l = el.attributes.length; i < l; i++) {
    attributeNames.push(el.attributes[i].name);
  }
  attributeNames.filter(function (k) {
    return !(k in tinierEl.attributes) || tinierEl.attributes[k] === false;
  }).map(function (k) {
    if (k in ATTRIBUTE_RENAME_REV) {
      el.removeAttribute(ATTRIBUTE_RENAME_REV[k]);
    } else if (k in ATTRIBUTE_APPLY) {
      ATTRIBUTE_APPLY[k](el, tinierEl.tagName);
    } else {
      el.removeAttribute(k);
    }
  });
  // Delete styles if not provided.
  var tStyle = tinierEl.attributes.style;
  if (tStyle && !isString(tStyle)) {
    getStyles(el.style.cssText).filter(function (a) {
      return !(a in tStyle || toCamelCase(a) in tStyle);
    }).map(function (a) {
      return el.style.removeProperty(a);
    });
  }

  // call the callback
  if (thenFn) {
    defer(function () {
      return thenFn(el);
    });
  }

  return el;
}

/**
* flatten the elements array
*/
function flattenElementsAr(ar) {
  return ar.reduce(function (acc, el) {
    return isArray(el) ? [].concat(acc, el) : [].concat(acc, [el]);
  }, []).filter(notNull); // null means ignore
}

function removeExtraNodes(container, length) {
  for (var i = container.childNodes.length - 1; i >= length; i--) {
    container.removeChild(container.childNodes[i]);
  }
}

/**
 * Render the given element tree into the container.
 * @param {Element} container - A DOM element that will be the container for
 *                              the renedered element tree.
 * @param {...[Object|String]|Object|String} tinierElementsAr -
 *   Any number of TinierDOM elements or strings that will be rendered.
 * @return {Object} A nested data structure of bindings for use in Tinier.
 */
function render(container) {
  // check arguments
  if (!isElement(container)) {
    throw new Error('First argument must be a DOM Element.');
  }

  for (var _len4 = arguments.length, tinierElementsAr = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
    tinierElementsAr[_key4 - 1] = arguments[_key4];
  }

  var tinierElements = flattenElementsAr(tinierElementsAr);

  var first = get(tinierElements, 0);
  if (isTinierBinding(first)) {
    if (tinierElements.length !== 1) {
      throw new Error('A binding cannot have siblings in TinierDOM. ' + 'At binding: [ ' + first.address.join(', ') + ' ].');
    }
    return objectForBindings([addressToObj(first.address, container)]);
  }

  // get the children with IDs
  var childrenWithKeys = Array.from(container.children).filter(function (c) {
    return c.id;
  });
  var elementsByID = keyBy(childrenWithKeys, 'id');

  // render each element
  var bindingsAr = tinierElements.map(function (tinierEl, i) {
    // If an element if a binding, then there can only be one child.
    if (isUndefined(tinierEl)) {
      // cannot be undefined
      throw new Error('Children in Tinier Elements cannot be undefined.');
    } else if (isTinierElement(tinierEl)) {
      // container.childNodes is a live collection, so get the current node at
      // this index.
      var el = container.childNodes[i];
      // tinierEl is a TinierDOM element.
      if (tinierEl.attributes.id in elementsByID) {
        // el exist, then check for a matching node by ID
        var movedEl = elementsByID[tinierEl.attributes.id];
        if (el) {
          // if match and existing el, then replace the element
          container.replaceChild(movedEl, el);
        } else {
          // if match and el is undefined, then append the element
          container.appendChild(movedEl);
        }
        // then render children
        return render.apply(undefined, [movedEl].concat(tinierEl.children));
      } else if (el) {
        // both defined, check type and id
        if (el.tagName && el.tagName.toLowerCase() === tinierEl.tagName.toLowerCase()) {
          // matching tag, then update the node to match. Be aware that existing
          // nodes with IDs might get moved, so we should clone them?
          var elToUpdate = el.id ? el.cloneNode(true) : el;
          updateDOMElement(elToUpdate, tinierEl);
          if (el.id) container.replaceChild(elToUpdate, el);
          return render.apply(undefined, [elToUpdate].concat(tinierEl.children));
        } else {
          // not a matching tag, then replace the element with a new one
          var newEl = createDOMElement(tinierEl, container);
          container.replaceChild(newEl, el);
          return render.apply(undefined, [newEl].concat(tinierEl.children));
        }
      } else {
        // no el and no ID match, then add a new Element or string node
        var newEl2 = createDOMElement(tinierEl, container);
        container.appendChild(newEl2);
        return render.apply(undefined, [newEl2].concat(tinierEl.children));
      }
      // There should not be any bindings here
    } else if (isTinierBinding(tinierEl)) {
      throw new Error('A binding cannot have siblings in TinierDOM. ' + 'At binding: [ ' + tinierEl.address.join(', ') + ' ].');
    } else {
      var _el = container.childNodes[i];
      var s = String(tinierEl);
      // This should be a text node.
      if (isText(_el)) {
        // If already a text node, then set the text content.
        _el.textContent = s;
      } else if (_el) {
        // If not a text node, then replace it.
        container.replaceChild(document.createTextNode(s), _el);
      } else {
        // If no existing node, then add a new one.
        container.appendChild(document.createTextNode(s));
      }
      // No binding here.
      return null;
    }
  });

  // remove extra nodes
  // TODO This should not run if the child is a binding. Make a test for
  // this. When else should it not run?
  removeExtraNodes(container, tinierElements.length);

  // bindings array to object
  return objectForBindings(bindingsAr.filter(function (b) {
    return b !== null;
  }));
}

// export API
exports.default = {
  arrayOf: arrayOf, objectOf: objectOf, createComponent: createComponent, run: run, bind: bind, createElement: createElement, render: render
};

},{}],38:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],39:[function(require,module,exports){
/**
* vkBeautify - javascript plugin to pretty-print or minify text in XML, JSON, CSS and SQL formats.
*  
* Version - 0.99.00.beta 
* Copyright (c) 2012 Vadim Kiryukhin
* vkiryukhin @ gmail.com
* http://www.eslinstructor.net/vkbeautify/
* 
* Dual licensed under the MIT and GPL licenses:
*   http://www.opensource.org/licenses/mit-license.php
*   http://www.gnu.org/licenses/gpl.html
*
*   Pretty print
*
*        vkbeautify.xml(text [,indent_pattern]);
*        vkbeautify.json(text [,indent_pattern]);
*        vkbeautify.css(text [,indent_pattern]);
*        vkbeautify.sql(text [,indent_pattern]);
*
*        @text - String; text to beatufy;
*        @indent_pattern - Integer | String;
*                Integer:  number of white spaces;
*                String:   character string to visualize indentation ( can also be a set of white spaces )
*   Minify
*
*        vkbeautify.xmlmin(text [,preserve_comments]);
*        vkbeautify.jsonmin(text);
*        vkbeautify.cssmin(text [,preserve_comments]);
*        vkbeautify.sqlmin(text);
*
*        @text - String; text to minify;
*        @preserve_comments - Bool; [optional];
*                Set this flag to true to prevent removing comments from @text ( minxml and mincss functions only. )
*
*   Examples:
*        vkbeautify.xml(text); // pretty print XML
*        vkbeautify.json(text, 4 ); // pretty print JSON
*        vkbeautify.css(text, '. . . .'); // pretty print CSS
*        vkbeautify.sql(text, '----'); // pretty print SQL
*
*        vkbeautify.xmlmin(text, true);// minify XML, preserve comments
*        vkbeautify.jsonmin(text);// minify JSON
*        vkbeautify.cssmin(text);// minify CSS, remove comments ( default )
*        vkbeautify.sqlmin(text);// minify SQL
*
*/
function createShiftArr(step) {

	var space = '    ';
	
	if ( isNaN(parseInt(step)) ) {  // argument is string
		space = step;
	} else { // argument is integer
		switch(step) {
			case 1: space = ' '; break;
			case 2: space = '  '; break;
			case 3: space = '   '; break;
			case 4: space = '    '; break;
			case 5: space = '     '; break;
			case 6: space = '      '; break;
			case 7: space = '       '; break;
			case 8: space = '        '; break;
			case 9: space = '         '; break;
			case 10: space = '          '; break;
			case 11: space = '           '; break;
			case 12: space = '            '; break;
		}
	}

	var shift = ['\n']; // array of shifts
	for(ix=0;ix<100;ix++){
		shift.push(shift[ix]+space); 
	}
	return shift;
}

function vkbeautify(){
	this.step = '    '; // 4 spaces
	this.shift = createShiftArr(this.step);
};

vkbeautify.prototype.xml = function(text,step) {

	var ar = text.replace(/>\s{0,}</g,"><")
				 .replace(/</g,"~::~<")
				 .replace(/\s*xmlns\:/g,"~::~xmlns:")
				 .replace(/\s*xmlns\=/g,"~::~xmlns=")
				 .split('~::~'),
		len = ar.length,
		inComment = false,
		deep = 0,
		str = '',
		ix = 0,
		shift = step ? createShiftArr(step) : this.shift;

		for(ix=0;ix<len;ix++) {
			// start comment or <![CDATA[...]]> or <!DOCTYPE //
			if(ar[ix].search(/<!/) > -1) { 
				str += shift[deep]+ar[ix];
				inComment = true; 
				// end comment  or <![CDATA[...]]> //
				if(ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1 || ar[ix].search(/!DOCTYPE/) > -1 ) { 
					inComment = false; 
				}
			} else 
			// end comment  or <![CDATA[...]]> //
			if(ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) { 
				str += ar[ix];
				inComment = false; 
			} else 
			// <elm></elm> //
			if( /^<\w/.exec(ar[ix-1]) && /^<\/\w/.exec(ar[ix]) &&
				/^<[\w:\-\.\,]+/.exec(ar[ix-1]) == /^<\/[\w:\-\.\,]+/.exec(ar[ix])[0].replace('/','')) { 
				str += ar[ix];
				if(!inComment) deep--;
			} else
			 // <elm> //
			if(ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) == -1 && ar[ix].search(/\/>/) == -1 ) {
				str = !inComment ? str += shift[deep++]+ar[ix] : str += ar[ix];
			} else 
			 // <elm>...</elm> //
			if(ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) > -1) {
				str = !inComment ? str += shift[deep]+ar[ix] : str += ar[ix];
			} else 
			// </elm> //
			if(ar[ix].search(/<\//) > -1) { 
				str = !inComment ? str += shift[--deep]+ar[ix] : str += ar[ix];
			} else 
			// <elm/> //
			if(ar[ix].search(/\/>/) > -1 ) { 
				str = !inComment ? str += shift[deep]+ar[ix] : str += ar[ix];
			} else 
			// <? xml ... ?> //
			if(ar[ix].search(/<\?/) > -1) { 
				str += shift[deep]+ar[ix];
			} else 
			// xmlns //
			if( ar[ix].search(/xmlns\:/) > -1  || ar[ix].search(/xmlns\=/) > -1) { 
				str += shift[deep]+ar[ix];
			} 
			
			else {
				str += ar[ix];
			}
		}
		
	return  (str[0] == '\n') ? str.slice(1) : str;
}

vkbeautify.prototype.json = function(text,step) {

	var step = step ? step : this.step;
	
	if (typeof JSON === 'undefined' ) return text; 
	
	if ( typeof text === "string" ) return JSON.stringify(JSON.parse(text), null, step);
	if ( typeof text === "object" ) return JSON.stringify(text, null, step);
		
	return text; // text is not string nor object
}

vkbeautify.prototype.css = function(text, step) {

	var ar = text.replace(/\s{1,}/g,' ')
				.replace(/\{/g,"{~::~")
				.replace(/\}/g,"~::~}~::~")
				.replace(/\;/g,";~::~")
				.replace(/\/\*/g,"~::~/*")
				.replace(/\*\//g,"*/~::~")
				.replace(/~::~\s{0,}~::~/g,"~::~")
				.split('~::~'),
		len = ar.length,
		deep = 0,
		str = '',
		ix = 0,
		shift = step ? createShiftArr(step) : this.shift;
		
		for(ix=0;ix<len;ix++) {

			if( /\{/.exec(ar[ix]))  { 
				str += shift[deep++]+ar[ix];
			} else 
			if( /\}/.exec(ar[ix]))  { 
				str += shift[--deep]+ar[ix];
			} else
			if( /\*\\/.exec(ar[ix]))  { 
				str += shift[deep]+ar[ix];
			}
			else {
				str += shift[deep]+ar[ix];
			}
		}
		return str.replace(/^\n{1,}/,'');
}

//----------------------------------------------------------------------------

function isSubquery(str, parenthesisLevel) {
	return  parenthesisLevel - (str.replace(/\(/g,'').length - str.replace(/\)/g,'').length )
}

function split_sql(str, tab) {

	return str.replace(/\s{1,}/g," ")

				.replace(/ AND /ig,"~::~"+tab+tab+"AND ")
				.replace(/ BETWEEN /ig,"~::~"+tab+"BETWEEN ")
				.replace(/ CASE /ig,"~::~"+tab+"CASE ")
				.replace(/ ELSE /ig,"~::~"+tab+"ELSE ")
				.replace(/ END /ig,"~::~"+tab+"END ")
				.replace(/ FROM /ig,"~::~FROM ")
				.replace(/ GROUP\s{1,}BY/ig,"~::~GROUP BY ")
				.replace(/ HAVING /ig,"~::~HAVING ")
				//.replace(/ SET /ig," SET~::~")
				.replace(/ IN /ig," IN ")
				
				.replace(/ JOIN /ig,"~::~JOIN ")
				.replace(/ CROSS~::~{1,}JOIN /ig,"~::~CROSS JOIN ")
				.replace(/ INNER~::~{1,}JOIN /ig,"~::~INNER JOIN ")
				.replace(/ LEFT~::~{1,}JOIN /ig,"~::~LEFT JOIN ")
				.replace(/ RIGHT~::~{1,}JOIN /ig,"~::~RIGHT JOIN ")
				
				.replace(/ ON /ig,"~::~"+tab+"ON ")
				.replace(/ OR /ig,"~::~"+tab+tab+"OR ")
				.replace(/ ORDER\s{1,}BY/ig,"~::~ORDER BY ")
				.replace(/ OVER /ig,"~::~"+tab+"OVER ")

				.replace(/\(\s{0,}SELECT /ig,"~::~(SELECT ")
				.replace(/\)\s{0,}SELECT /ig,")~::~SELECT ")
				
				.replace(/ THEN /ig," THEN~::~"+tab+"")
				.replace(/ UNION /ig,"~::~UNION~::~")
				.replace(/ USING /ig,"~::~USING ")
				.replace(/ WHEN /ig,"~::~"+tab+"WHEN ")
				.replace(/ WHERE /ig,"~::~WHERE ")
				.replace(/ WITH /ig,"~::~WITH ")
				
				//.replace(/\,\s{0,}\(/ig,",~::~( ")
				//.replace(/\,/ig,",~::~"+tab+tab+"")

				.replace(/ ALL /ig," ALL ")
				.replace(/ AS /ig," AS ")
				.replace(/ ASC /ig," ASC ")	
				.replace(/ DESC /ig," DESC ")	
				.replace(/ DISTINCT /ig," DISTINCT ")
				.replace(/ EXISTS /ig," EXISTS ")
				.replace(/ NOT /ig," NOT ")
				.replace(/ NULL /ig," NULL ")
				.replace(/ LIKE /ig," LIKE ")
				.replace(/\s{0,}SELECT /ig,"SELECT ")
				.replace(/\s{0,}UPDATE /ig,"UPDATE ")
				.replace(/ SET /ig," SET ")
							
				.replace(/~::~{1,}/g,"~::~")
				.split('~::~');
}

vkbeautify.prototype.sql = function(text,step) {

	var ar_by_quote = text.replace(/\s{1,}/g," ")
							.replace(/\'/ig,"~::~\'")
							.split('~::~'),
		len = ar_by_quote.length,
		ar = [],
		deep = 0,
		tab = this.step,//+this.step,
		inComment = true,
		inQuote = false,
		parenthesisLevel = 0,
		str = '',
		ix = 0,
		shift = step ? createShiftArr(step) : this.shift;;

		for(ix=0;ix<len;ix++) {
			if(ix%2) {
				ar = ar.concat(ar_by_quote[ix]);
			} else {
				ar = ar.concat(split_sql(ar_by_quote[ix], tab) );
			}
		}
		
		len = ar.length;
		for(ix=0;ix<len;ix++) {
			
			parenthesisLevel = isSubquery(ar[ix], parenthesisLevel);
			
			if( /\s{0,}\s{0,}SELECT\s{0,}/.exec(ar[ix]))  { 
				ar[ix] = ar[ix].replace(/\,/g,",\n"+tab+tab+"")
			} 
			
			if( /\s{0,}\s{0,}SET\s{0,}/.exec(ar[ix]))  { 
				ar[ix] = ar[ix].replace(/\,/g,",\n"+tab+tab+"")
			} 
			
			if( /\s{0,}\(\s{0,}SELECT\s{0,}/.exec(ar[ix]))  { 
				deep++;
				str += shift[deep]+ar[ix];
			} else 
			if( /\'/.exec(ar[ix]) )  { 
				if(parenthesisLevel<1 && deep) {
					deep--;
				}
				str += ar[ix];
			}
			else  { 
				str += shift[deep]+ar[ix];
				if(parenthesisLevel<1 && deep) {
					deep--;
				}
			} 
			var junk = 0;
		}

		str = str.replace(/^\n{1,}/,'').replace(/\n{1,}/g,"\n");
		return str;
}


vkbeautify.prototype.xmlmin = function(text, preserveComments) {

	var str = preserveComments ? text
							   : text.replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g,"")
									 .replace(/[ \r\n\t]{1,}xmlns/g, ' xmlns');
	return  str.replace(/>\s{0,}</g,"><"); 
}

vkbeautify.prototype.jsonmin = function(text) {

	if (typeof JSON === 'undefined' ) return text; 
	
	return JSON.stringify(JSON.parse(text), null, 0); 
				
}

vkbeautify.prototype.cssmin = function(text, preserveComments) {
	
	var str = preserveComments ? text
							   : text.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g,"") ;

	return str.replace(/\s{1,}/g,' ')
			  .replace(/\{\s{1,}/g,"{")
			  .replace(/\}\s{1,}/g,"}")
			  .replace(/\;\s{1,}/g,";")
			  .replace(/\/\*\s{1,}/g,"/*")
			  .replace(/\*\/\s{1,}/g,"*/");
}

vkbeautify.prototype.sqlmin = function(text) {
	return text.replace(/\s{1,}/g," ").replace(/\s{1,}\(/,"(").replace(/\s{1,}\)/,")");
}

module.exports = new vkbeautify();


},{}]},{},[30])(30)
});
//# sourceMappingURL=escher.js.map
