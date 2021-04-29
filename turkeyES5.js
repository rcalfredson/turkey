"use strict";

var simplifyjs = require('simplify-js');

var dragged, dragStart;
var myChild, myParent, canvas, ctx, img;
var modes, classSelection;
var transparency_level = 0.5;
var pointerDown = false;
var newScale = 1.0;
var zoom = 1.0;
var mode = "";
var modeNum = 0;
var scaleTransform = 1;
var translateTransform = [0, 0];
var delete_mode = false;
var delete_idx = -1;
var trashcan = new Array();
var colors = {};
var timeDownUp = null;
var rightClick = false;

var getRandColor = function getRandColor() {
  var randomColor = "#000000".replace(/0/g, function () {
    return (~~(Math.random() * 16)).toString(16);
  });
  return randomColor;
};

var brush = {
  pathOptions: {
    strokeColor: 'white',
    strokeWidth: 1,
    radius: 10
  }
};
var brushScaleFactor = 3;
var origCenter;
var tool;
var brushStroke;
var activeColor = getRandColor();
var brushUnited;
var pointsUnited;
var backgroundRaster;
var prevPoint;
var picHeight, picWidth;
window.oldBrushes = {};
var paperJstoTimeIds = {};
window.annotations = null;
var currentLink = {
  'class': [],
  'mode': 'link',
  'data': []
};
var currentPolygon = {
  'class': [],
  'mode': 'polygon',
  'data': []
};
var currentBbox = {
  'class': [],
  'mode': 'bbox',
  'data': []
};

String.prototype.hashCode = function () {
  var hash = 0;

  if (this.length == 0) {
    return hash;
  }

  for (var i = 0; i < this.length; i++) {
    var _char = this.charCodeAt(i);

    hash = (hash << 5) - hash + _char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash;
};

var createBrush = function createBrush(center) {
  center = center || new paper.Point(0, 0);

  if (brush.path !== undefined) {
    center = new paper.Point(brush.path.position.x, brush.path.position.y);
    brush.path.remove();
  }

  brush.path = new paper.Path.Circle({
    strokeColor: brush.pathOptions.strokeColor,
    strokeWidth: brush.pathOptions.strokeWidth,
    radius: brush.pathOptions.radius,
    center: center
  });
};

var uniteCurrentAnnotation = function uniteCurrentAnnotation(existing, newStroke) {
  var newCompound = new paper.CompoundPath();

  if (brushUnited instanceof paper.CompoundPath) {
    newCompound = brushUnited.unite(newStroke);
  } else {
    newCompound = newCompound.unite(newStroke);
  }

  if (newCompound instanceof paper.Path) {
    newCompound = new paper.CompoundPath(newCompound);
  }

  var newChildren = [];
  newCompound.children.forEach(function (path) {
    var points = [];
    path.segments.forEach(function (seg) {
      points.push({
        x: seg.point.x,
        y: seg.point.y
      });
    });
    points = simplifyjs(points, 1, true);
    var newPath = new paper.Path(points);
    newPath.closePath();
    newChildren.push(newPath);
  });
  newCompound.removeChildren();
  newCompound.addChildren(newChildren);

  if (brushUnited instanceof paper.CompoundPath) {
    brushUnited.remove();
  }

  brushUnited = newCompound;
  brushUnited.fillColor = activeColor;
  brushUnited.opacity = transparency_level;
  brushUnited.selected = true;
  pointsUnited = [];
  brushUnited.children.forEach(function (path) {
    var points = [];
    path.segments.forEach(function (seg) {
      points.push(seg.point.x);
      points.push(seg.point.y); // points.push({ x: seg.point.x, y: seg.point.y });
    });
    pointsUnited.push(points);
  });
  addHoverHandlers();
};

function toggleDelete() {
  setDeleteMode(!getDeleteMode());
}

function getClass() {
  return classSelection[classSelection.selectedIndex].innerHTML;
}

var addHoverHandlers = function addHoverHandlers() {
  Object.values(window.oldBrushes).concat([brushUnited]).forEach(function (myBrush) {
    if (myBrush.finished === true) {
      myBrush = myBrush.brush;
    }

    myBrush.onMouseEnter = function (event) {
      if (delete_mode && myBrush !== null) {
        myBrush.normalFillColor = myBrush.fillColor;
        myBrush.fillColor = 'red';
      }
    };

    myBrush.onClick = function (event) {
      if (delete_mode) {
        if (Object.keys(paperJstoTimeIds).includes(this.id.toString())) {
          window.oldBrushes[paperJstoTimeIds[this.id]].brush.remove();
          delete window.oldBrushes[paperJstoTimeIds[this.id]];
          delete paperJstoTimeIds[this.id];
        } else {
          brushUnited.remove();
          brushUnited = null;
        }
      }
    };

    myBrush.onMouseLeave = function (event) {
      if (myBrush !== null && myBrush.normalFillColor !== undefined) {
        myBrush.fillColor = myBrush.normalFillColor;
      }
    };
  });
};

function toggleMode() {
  modeNum += 1;

  if (modeNum >= modes.length) {
    modeNum = 0;
  }

  setDeleteMode(false);
  mode = modes[modeNum];
  modeButton.value = 'Mode: ' + capitalize(mode);
  clearCurrentAnn();
}

var setKeyboardHandlers = function setKeyboardHandlers() {
  paper.view.on("keydown", function (evt) {
    // Press E for "Mode toggle"
    if (evt.key == 'e') {
      toggleMode();
    } // Press ctrl + Z for "Undo"


    if (evt.key == 'z' && evt.ctrlKey) {
      undo();
    } // Press D for "Delete"


    if (evt.key == 'd') {
      toggleDelete();
    }

    if (evt.key == 'c' && mode == 'brush') {
      var brushId = Date.now();
      window.oldBrushes[brushId] = {
        "class": getClass(),
        color: activeColor,
        brush: brushUnited,
        points: pointsUnited,
        id: brushId,
        finished: true
      };
      paperJstoTimeIds[brushUnited.id] = brushId;
      activeColor = getRandColor();
      brushUnited = null;
      updateGraphics();
    }
  }, true);
};

var changeZoom = function changeZoom(delta, p) {
  var oldZoom = paper.view.zoom;
  var c = paper.view.center;
  var factor = 1 + zoom;
  var zoomTemp = delta < 0 ? oldZoom * factor : oldZoom / factor;
  var beta = oldZoom / zoomTemp;
  var pc = p.subtract(c);
  var a = p.subtract(pc.multiply(beta)).subtract(c);
  return {
    zoom: zoomTemp,
    offset: a
  };
};

var zoomInAndOut = function zoomInAndOut(e) {
  e.preventDefault();
  var view = paper.view;
  var viewPosition = view.viewToProject(new paper.Point(e.offsetX, e.offsetY));
  var transform = changeZoom(e.deltaY, viewPosition);

  if (transform.zoom < 10 && transform.zoom > 0.01) {
    newScale = 1 / transform.zoom;
    paper.view.zoom = transform.zoom;
    paper.view.center = view.center.add(transform.offset);
  }

  scale();
};

var scale = function scale() {
  brush.pathOptions.strokeWidth = newScale * brushScaleFactor;
  if (brush.path != null) brush.path.strokeWidth = newScale * brushScaleFactor;
};

function updateGraphics() {
  Object.values(window.oldBrushes).forEach(function (brush) {
    brush.brush.selected = false;
    brush.brush.opacity = transparency_level;
    brush.brush.bringToFront();
  });
}

var setPointerHandlers = function setPointerHandlers() {
  canvas.addEventListener('wheel', zoomInAndOut, {
    passive: false
  });
  window.addEventListener('pointerdown', function (evt) {
    rightClick = evt.which == 3;
  });
  paper.view.on('mousedown', function (evt) {
    pointerDown = true;

    if (mode == 'brush' && !delete_mode && !rightClick) {
      createSelection();
      draw();
    }

    timeDownUp = new Date().getTime();
    anchorX = evt.clientX;
    anchorY = evt.clientY;
    dragged = false;
    dragStart = true;
  });
  paper.view.on('mouseup', function (evt) {
    pointerDown = false;
    timeDownUp = new Date().getTime();

    if (mode == 'brush' && !delete_mode && !rightClick) {
      uniteCurrentAnnotation(brushUnited, brushStroke);
      removeSelection();
    }

    dragStart = false;
    rightClick = false;
    updateGraphics();
  });
};

function setDeleteMode(deleteMode) {
  if (deleteMode == true && $("#delete_button").hasClass("disabled")) {
    return;
  }

  if (typeof deleteMode !== 'boolean') {
    deleteMode = deleteMode.target.id === 'delete_button';
  }

  delete_mode = deleteMode;

  if (delete_mode == false) {
    // annotate mode
    canvas.style.cursor = "none";
    $("#delete_button").removeClass('btn-primary');
    $("#delete_button").addClass('btn-outline-secondary');
    $("#annotate_button").removeClass('btn-outline-secondary');
    $("#annotate_button").addClass('btn-primary');
    createBrush();
    updateGraphics();
  } else {
    // delete mode
    if (brush.path !== undefined) {
      brush.path.remove();
    }

    canvas.style.cursor = "pointer";
    $("#annotate_button").removeClass('btn-primary');
    $("#annotate_button").addClass('btn-outline-secondary');
    $("#delete_button").removeClass('btn-outline-secondary');
    $("#delete_button").addClass('btn-primary');
    updateGraphics();
  }
}

var setDragHandler = function setDragHandler() {
  var toolPan = new paper.Tool();

  toolPan.onMouseDrag = function (evt) {
    if (!rightClick) {
      return;
    }

    var timeMove = new Date().getTime();

    if (timeMove > timeDownUp) {
      if (dragStart) {
        dragged = true;
        var offset = new paper.Point(evt.downPoint.x - evt.point.x, evt.downPoint.y - evt.point.y);
        var new_center = paper.view.center.add(offset);
        paper.view.setCenter(new_center);
      }
    } else {
      timeDownUp = null;
    }
  };
};

var setMouseMoveHandler = function setMouseMoveHandler() {
  paper.view.on('mousemove', function (evt) {
    if (prevPoint === undefined) {
      if (evt.downPoint !== undefined) {
        prevPoint = evt.downPoint;
      } else {
        prevPoint = new paper.Point(evt.point.x, evt.point.y);
      }
    }

    if (mode == 'brush' && !delete_mode && !rightClick) {
      if (pointerDown) {
        moveBrush(evt);
        draw();
      } else {
        moveBrush(evt);
      }
    }

    if (getDeleteMode() == true) {} else if (rightClick) {} else if (mode == "bbox" && dragStart) {
      dragged = true;
      updateGraphics();
    } else if (mode == "link") {
      updateGraphics();
    }
  });
};

function getDeleteMode() {
  return delete_mode;
}

var moveBrush = function moveBrush(evt) {
  if (brush.path == null) createBrush();
  brush.path.bringToFront();
  brush.path.position = evt.point;
};

var createSelection = function createSelection() {
  brushStroke = new paper.Path({
    strokeColor: brush.pathOptions.strokeColor,
    strokeWidth: brush.pathOptions.strokeWidth
  });
};

var removeSelection = function removeSelection() {
  if (brushStroke != null) {
    brushStroke.remove();
    brushStroke = null;
  }
};

var draw = function draw() {
  var newSelection = brushStroke.unite(brush.path);
  brushStroke.remove();
  brushStroke = newSelection;
};

var setupCanvas = function setupCanvas() {
  paper.install(window);
  paper.setup(canvas);
  window.focus();
  setMouseMoveHandler();
  setPointerHandlers();
  setKeyboardHandlers();
  setDragHandler();
  backgroundRaster = new paper.Raster('pic');

  backgroundRaster.onLoad = function () {
    backgroundRaster.sendToBack();
    backgroundRaster.position = paper.view.center;
    backgroundRaster.scale(1200 / backgroundRaster.width);
    document.getElementById('pic').remove();
  };

  origCenter = paper.view.center;
};

var start = function start() {
  myParent = document.getElementById("editorOuter");
  myChild = document.getElementById("editorInner");
  canvas = document.getElementById("myCanvas");
  ctx = canvas.getContext("2d");
  img = document.getElementById("pic");

  if (document.getElementById('pic').complete) {
    picHeight = $('#pic').height();
    picWidth = $('#pic').width();
    canvas.width = picWidth;
    canvas.height = picHeight;
    myParent.style.height = "".concat(picHeight, "px");
    myChild.style.height = "".concat(picHeight, "px");
    setupCanvas();
  } else {
    $('#pic').one('load', function () {
      picHeight = $(this).height();
      picWidth = $(this).width();
      canvas.width = picWidth;
      myParent.style.height = "".concat(picHeight, "px");
      myChild.style.height = "".concat(picHeight, "px");
      canvas.height = picHeight;
      setupCanvas();
    });
  }

  modeButton = document.getElementById("mode_button");
  canvas.style.cursor = "none";
  $('#instruction').slideUp(1000);
  $('#title').click(function () {
    $('#instruction').clearQueue();
    $('#instruction').slideToggle();
  });
  window.annotations = {};
  mode_data = "brush";
  modes = mode_data.split('-');
  mode = modes[0];
  modeButton.value = 'Mode: ' + capitalize(mode); // generate select list options

  classSelection = document.getElementById("object-class");
  var classes_data = "${classes}";

  if (classes_data == "$" + "{classes}") // running in local demo mode
    {
      classes_data = "egg";
    }

  classes = classes_data.split('-'); // populate list items and generate unique colors based on string hash

  classes.forEach(function (theClass) {
    var option = document.createElement("option");
    var hue = Math.abs(theClass.hashCode() % 360) / 360;
    var color = [hue, 1.0, 1.0];
    option.innerHTML = theClass;
    classSelection.appendChild(option);
    colors[theClass] = color;
  });
  classSelection.size = Math.min(10, classes.length);
  classSelection.selectedIndex = 0;
  updateGraphics(); //initialize sliders

  var transparencySlider = document.getElementById('transparency_slider');

  transparencySlider.oninput = function () {
    transparency_level = this.value / 100.0;

    if (brushUnited !== null) {
      brushUnited.opacity = transparency_level;
    }

    updateGraphics();
  };

  var brushRadSlider = document.getElementById('brush_rad_slider');

  brushRadSlider.oninput = function () {
    brush.pathOptions.radius = this.value;
    createBrush();
  }; //initialize buttons


  $("#reset_button").click(reset);
  $("#reposition_button").click(reposition); // $("#undo_button").click(undo);

  $("#mode_button").click(toggleMode);
  $("#delete_button").click(setDeleteMode);
  $("#annotate_button").click(setDeleteMode);
  document.getElementById("submitButton").disabled = false;
  document.getElementById("buttons").appendChild(document.getElementById("submitButton")); // disable right click context menu on canvas

  canvas.oncontextmenu = function () {
    return false;
  };

  canvas.addEventListener('mouseout', function (evt) {
    dragStart = false;
    dragged = false;
  });

  function reset() {
    clearAnnotations();
    reposition();
    firstPoint = true;
    dragStart = false;
    dragged = false;
    setDeleteMode(false);
  }

  function reposition() {
    paper.view.zoom = 1;
    paper.view.center = origCenter;
    newScale = 1 / 3;
    scale();
  }

  function clearAnnotations() {
    Object.values(window.oldBrushes).forEach(function (brush) {
      brush.brush.remove();
    });
    window.oldBrushes = {};
    brushUnited.remove();
    brushUnited = null;
    trashcan = new Array();
    currentLink = {
      'class': [],
      'mode': 'link',
      'data': []
    };
    currentPolygon = {
      'class': [],
      'mode': 'polygon',
      'data': []
    };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } // Redraw all annotations
  // depending on mode, either undo deletion or undo annotation


  function undo() {
    if (getDeleteMode() == true) {
      if (trashcan.length > 0) {
        window.annotations.push(trashcan.pop());
      }
    } else {
      switch (mode) {
        case "dot":
          window.annotations.pop();
          break;

        case "link":
          if (currentLink.data.length == 0) {
            window.annotations.pop();
          } else {
            currentLink.data = new Array();
            firstPoint = true;
          }

          break;

        case "polygon":
          if (currentPolygon.data.length == 0) {
            window.annotations.pop();
          } else {
            currentPolygon.data.pop();
          }

          break;

        case "bbox":
          if (currentBbox.data.length == 0) {
            window.annotations.pop();
          } else {
            currentBbox.data = new Array();
            dragStart = false;
            dragged = false;
          }

      }
    }

    updateGraphics();
  }
};

start();

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function mean(array) {
  var total = 0;

  for (var j = 0; j < array.length; j++) {
    total += array[j];
  }

  var avg = total / array.length;
  return avg;
}

function HSVtoRGB(h, s, v) {
  // Borrowed from https://stackoverflow.com/a/17243070/4970438
  var r, g, b, i, f, p, q, t;

  if (arguments.length === 1) {
    s = h.s, v = h.v, h = h.h;
  }

  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v, g = t, b = p;
      break;

    case 1:
      r = q, g = v, b = p;
      break;

    case 2:
      r = p, g = v, b = t;
      break;

    case 3:
      r = p, g = q, b = v;
      break;

    case 4:
      r = t, g = p, b = v;
      break;

    case 5:
      r = v, g = p, b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function getColor(ann) {
  var color = colors[ann["class"]];
  var h = color[0];
  var s = color[1];
  var v = color[2];
  var rgbColors = HSVtoRGB(h, s, v);
  var r = rgbColors.r.toString();
  var g = rgbColors.g.toString();
  var b = rgbColors.b.toString();
  return [r, g, b];
}
