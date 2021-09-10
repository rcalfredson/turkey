import html2canvas from 'html2canvas';
let simplifyjs = require('simplify-js');
let randomColor = require('randomcolor');

// Warn if overriding existing method
if (Array.prototype.equals)
  console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
  // if the other array is a falsy value, return
  if (!array)
    return false;

  // compare lengths - can save a lot of time 
  if (this.length != array.length)
    return false;

  for (var i = 0, l = this.length; i < l; i++) {
    // Check if we have nested arrays
    if (this[i] instanceof Array && array[i] instanceof Array) {
      // recurse into the nested arrays
      if (!this[i].equals(array[i]))
        return false;
    }
    else if (this[i] != array[i]) {
      // Warning - two different object instances will never be equal: {x:20} != {x:20}
      return false;
    }
  }
  return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", { enumerable: false });

var dragStart;
var myChild, myParent, canvas, ctx, pic;
var modes, modeButton, viewButton, classSelection;
var opacity_level = 0.5;
var pointerDown = false;
var instructionsShown;
var newScale = 1.0;
var zoom = 1.0;
var mode = "";
var modeNum = 0;
var editing_mode = 'annotate';
var timeDownUp = null;
var shiftKeyUsedDuringAction = false;
var keyDown = { shift: false, alt: false, ctrl: false };
var rightClick = false;
let lastScrollTime;
let lastMousePosition;
let brush = {
  pathOptions: {
    strokeColor: 'white',
    strokeWidth: 3,
    radius: 2
  }
}
let brushStrokeStartPoint;
let colors = {
  cautionYellow: new paper.Color(0.984, 1.0, 0),

  dullYellow: new paper.Color(0.933, 0.925, 0.475)
}
let history = [];
window.gtClickData = null;
window.gtClickPaths = [];
let outlineData = [];
let outlinePaths = [];
let outlineIgnoreIndices = [];
let outlineShownIndices = [];
let previousOutlineIndex;
let clickTimes = { up: null, down: null };
let undoButton;
let brushScaleFactor = 3;
let outlineScaleFactor = 2;
let outlineModeWidth = 2;
let origCenter;
let brushStroke;
let activeColor;
window.brushUnited = null;
let pointsUnited;
let separatedBrushes;
let backgroundRaster;
let letPictureMove = false;
window.blockPaperJsMouseEvents = false;
window.blockPaperJsKeyEvents = false;
let blockEdit = false;
let viewStyle;
let viewStyleNum = 1;
let viewStyles = ['fill', 'outline'];
window.oldBrushes = {};
let paperJstoTimeIds = {};
window.scriptLoadStatuses = { turkey: false, helpers: false };
let imageOffset;
let firstResize = true;
window.annotations = null;

var createBrush = function (center) {
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
}

function makeID(length, existing_ids = []) {
  var result = '';
  do {
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
  } while (existing_ids.indexOf(result) > 0)
  return result;
}

var createSeparateCompoundPathsForEachChild = () => {
  separatedBrushes = [];
  let numChildren = window.brushUnited.children.length;
  for (let index = 0; index < numChildren; index++) {
    let newBrush = new paper.CompoundPath(window.brushUnited.children[index].clone());
    newBrush.color = activeColor;
    separatedBrushes.push(newBrush)
  }
}

var collectPointsOnCurve = function (path) {
  let points = [];
  path.curves.forEach(c => {
    let latestCurveLocation = -1;
    let curveIndex = 0;
    while (latestCurveLocation !== null) {
      latestCurveLocation = c.getLocationAt(curveIndex);
      curveIndex += 1;
      if (latestCurveLocation !== null) {
        points.push({
          x: latestCurveLocation.point.x,
          y: latestCurveLocation.point.y
        });
      }
    }
  });
  return points;
}

var restorePriorUnitedAnnotation = function (priorBrushUnited) {
  if (priorBrushUnited.outlineId !== undefined) {
    removeItemOnce(outlineIgnoreIndices, priorBrushUnited.outlineId);
  }
  if (priorBrushUnited.type == 'annotation') {
    priorBrushUnited.ids.forEach(id => {
      window.oldBrushes[id].brush.remove();
      delete window.oldBrushes[id];
    });
  }
  if (!priorBrushUnited.brush) {
    if (window.brushUnited)
      window.brushUnited.remove();
    window.brushUnited = null;
    pointsUnited = [];
  } else {
    let oldColor = priorBrushUnited.color;
    priorBrushUnited = priorBrushUnited.brush;
    let newCompound = new paper.CompoundPath().unite(priorBrushUnited);
    if (newCompound instanceof paper.Path) {
      newCompound = new paper.CompoundPath(newCompound);
    }
    let newChildren = [];
    newCompound.children.forEach(path => {
      let points = collectPointsOnCurve(path);
      points = simplifyjs(points, 0.4, true);

      let newPath = new paper.Path(points);
      newPath.closePath();

      newChildren.push(newPath);
    });
    newCompound.removeChildren();
    newCompound.addChildren(newChildren);
    if (window.brushUnited instanceof paper.CompoundPath) {
      window.brushUnited.remove();
    }
    window.brushUnited = newCompound;
    setBrushAppearance(oldColor);
    activeColor = oldColor;
    window.brushUnited.selected = true;
    pointsUnited = []
    window.brushUnited.children.forEach(path => {
      let points = [];
      path.segments.forEach(seg => {
        points.push((seg.point.x - imageOffset.x) / backgroundRaster.scaling.x);
        points.push((seg.point.y - imageOffset.y) / backgroundRaster.scaling.y);
      });
      pointsUnited.push(points);
    });
  }
  addHoverHandlers();
}

var setBrushAppearance = function (color = activeColor) {
  window.brushUnited.opacity = opacity_level;
  if (viewStyle == 'outline') {
    window.brushUnited.fillColor = color;
    window.brushUnited.fillColor.alpha = 0.05;
    window.brushUnited.strokeColor = 'white';
    window.brushUnited.strokeWidth = outlineModeWidth;
  } else {
    window.brushUnited.fillColor = color;
    window.brushUnited.opacity = opacity_level;
  }
}

var updateCurrentAnnotation = function (newStroke, action, outlineId = undefined) {
  if ((window.brushUnited && window.brushUnited.outlineId !== undefined) || outlineId !== undefined) {
    previousOutlineIndex = outlineId;
  }
  history.push({ type: 'stroke', brush: window.brushUnited, color: activeColor, outlineId });
  document.getElementById('undo_button').disabled = false;
  if (history.length > 10) {
    history.shift();
  }
  let newCompound = new paper.CompoundPath();
  if (window.brushUnited instanceof paper.CompoundPath) {
    newCompound = window.brushUnited[action](newStroke);
  } else {
    newCompound = newCompound[action](newStroke);
  }
  if (newCompound instanceof paper.Path) {
    newCompound = new paper.CompoundPath(newCompound);
  }
  let newChildren = [];
  newCompound.children.forEach(path => {
    let points = collectPointsOnCurve(path);
    points = simplifyjs(points, 0.4, true);

    let newPath = new paper.Path(points);
    newPath.closePath();

    newChildren.push(newPath);
  });
  newCompound.removeChildren();
  newCompound.addChildren(newChildren);
  if (window.brushUnited instanceof paper.CompoundPath) {
    window.brushUnited.remove();
  }
  window.brushUnited = newCompound;
  window.brushUnited.selected = true;
  window.brushUnited.outlineId = outlineId;
  pointsUnited = []
  if (window.brushUnited.children.length > 1 &&
    window.brushUnited.children[1].bounds.area >
    window.brushUnited.children[0].bounds.area) {
    let tempCompound = new paper.CompoundPath(window.brushUnited.children[1]);
    window.brushUnited.remove();
    window.brushUnited = tempCompound.clone();
    window.brushUnited.selected = true;
    tempCompound.remove();
  } else {
    window.brushUnited.removeChildren(1);
  }
  setBrushAppearance();
  window.brushUnited.children.forEach(path => {
    let points = [];
    path.segments.forEach(seg => {
      points.push((seg.point.x - imageOffset.x) / backgroundRaster.scaling.x);
      points.push((seg.point.y - imageOffset.y) / backgroundRaster.scaling.y);
    });
    pointsUnited.push(points);
  });
  addHoverHandlers();
};

window.getCanvasDataUrl = function () {
  return canvas.toDataURL('image/jpeg');
}

function getClass() {
  return classSelection[classSelection.selectedIndex].innerHTML;
}

var addHoverHandlers = function () {
  Object.values(window.oldBrushes).concat([window.brushUnited]).forEach(myBrush => {
    if (!myBrush) {
      return;
    }
    if (myBrush.finished === true) {
      myBrush = myBrush.brush;
    }
    myBrush.onMouseEnter = function () {
      if (editing_mode === 'delete' && myBrush !== null) {
        myBrush.normalFillColor = myBrush.fillColor;
        myBrush.fillColor = 'red';
        myBrush.opacity = opacity_level;
      }
    }
    myBrush.onClick = function () {
      if (editing_mode === 'delete') {
        if (Object.keys(paperJstoTimeIds).includes(this.id.toString())) {
          window.oldBrushes[paperJstoTimeIds[this.id]].brush.remove();
          removeItemOnce(outlineIgnoreIndices, window.oldBrushes[paperJstoTimeIds[this.id]].outlineId)
          delete window.oldBrushes[paperJstoTimeIds[this.id]];
          delete paperJstoTimeIds[this.id];
        } else {
          removeItemOnce(outlineIgnoreIndices, previousOutlineIndex);
          window.brushUnited.remove();
          window.brushUnited = null;
        }
        refreshEggClickColors();
        window.updateHighlightingText();
      }
    }
    myBrush.onMouseLeave = function () {
      if (myBrush !== null && myBrush.normalFillColor !== undefined) {
        myBrush.fillColor = myBrush.normalFillColor;
        if (viewStyle == 'outline') {
          myBrush.fillColor.alpha = 0.05;
        } else {
          myBrush.fillColor.alpha = opacity_level;
        }
      }
    }
  });
}

function toggleView() {
  viewStyleNum += 1;
  if (viewStyleNum >= viewStyles.length) {
    viewStyleNum = 0;
  }
  viewStyle = viewStyles[viewStyleNum];
  updateGraphics();
  setViewButtonVal();
  localStorage.setItem('annotationViewStyle', viewStyle);
}

function setViewButtonVal() {
  viewButton.value = 'View style: ' + viewStyle;
}

function toggleMode() {
  modeNum += 1;
  if (modeNum >= modes.length) {
    modeNum = 0;
  }
  setDeleteMode(false);
  mode = modes[modeNum];
  modeButton.value = 'Mode: ' + capitalize(mode);
}

window.addEventListener('blur', (evt) => {
  if (keyDown.alt) {
    keyDown.alt = false;
  }
})

document.onkeydown = (e) => {
  var code = e.code;
  if (window.blockPaperJsKeyEvents) {
    return;
  }
  if (code === 'KeyZ' && e.ctrlKey) {
    undo();
  }
  if (e.key === 'Shift') {
    if (keyDown.shift) {
      return;
    }
    keyDown.shift = true;
    updatePotentialEggOutline('show');
    dragStart = true;
  }
  if (e.key === 'Alt') {
    keyDown.alt = true;
  }
  if (e.key === 'Control') {
    if (keyDown.ctrl) {
      return;
    }
    keyDown.ctrl = true;
    // updatePotentialEggOutline('show');
  }
}

document.onkeyup = (e) => {
  if (e.key === 'Shift') {
    keyDown.shift = false;
    updatePotentialEggOutline('hide');
    dragStart = false;
  }
  if (e.key === 'Alt') {
    keyDown.alt = false;
  }
  if (e.key === 'Control') {
    keyDown.ctrl = false;
    // updatePotentialEggOutline('hide');
  }
}

function updatePotentialEggOutline(action) {
  if (action === 'show') {
    outlinePaths.some((eggOutline, i) => {
      if (outlineIgnoreIndices.includes(i) || outlineShownIndices.length > 0 || outlineShownIndices.includes(i)) {
        return false;
      }
      let containsEgg = eggOutline.contains(lastMousePosition);
      if (containsEgg) {
        outlineShownIndices.push(i);
        revealSingleEggOutline(outlinePaths[i]);
        return true;
      }

    });
  } else if (action === 'hide') {
    outlineShownIndices.forEach(i => {
      hideSingleEggOutline(outlinePaths[i])
    });
    outlineShownIndices = [];
    return true;
  }
}

var findEnclosedEgg = function (path) {
  let distances = [];
  let indices = []
  window.gtClickPaths.forEach((clickPath, i) => {
    if (clickPath.fillColor._components.equals(colors.dullYellow._components)) {
      return;
    }
    if (path.contains(clickPath.position)) {
      distances.push(Math.sqrt(Math.pow(path.position.x - clickPath.position.x, 2)
        + Math.pow(path.position.y - clickPath.position.y, 2)));
      indices.push(i);
    }
  })
  if (distances.length === 0) {
    return false;
  }
  return indices[distances.indexOf(Math.min(...distances))];
}

var setKeyboardHandlers = () => {
  paper.view.on("keydown", function (evt) {
    if (window.blockPaperJsKeyEvents) {
      return;
    }
    // Press E for "Mode toggle"
    if (evt.key == 'e') {
      toggleMode();
    }

    // Press D for "Delete"
    if ((evt.key == 'd')) {
      if (editing_mode === 'delete') {
        setAnnotateMode('annotate');
      } else {
        setAnnotateMode('delete');
      }
    }

    if (evt.key == 'enter' && mode == 'brush') {
      window.confirmDrawnShapes();
    }
  }, true);
}

window.confirmDrawnShapes = () => {
  let brushId;

  createSeparateCompoundPathsForEachChild();
  let brushIds = []
  let trueImgBounds = new paper.Rectangle(0, 0,
    backgroundRaster.width * backgroundRaster.scaling.x,
    backgroundRaster.height * backgroundRaster.scaling.y
  );
  for (let index = 0; index < pointsUnited.length; index++) {
    brushId = makeID(6);
    let keepBrush = true;
    pointsUnited[index].some((pt, i) => {
      if (i % 2 === 1) {
        return false;
      }
      let ptChecked = new paper.Point(pt, pointsUnited[index][i + 1])
      if (!ptChecked.isInside(trueImgBounds)) {
        keepBrush = false;
      }
      return !keepBrush;
    });
    if (!keepBrush) {
      continue;
    }
    if (index > 0) {
      activeColor = randomColor();
    }
    window.oldBrushes[brushId] = {
      class: getClass(),
      color: activeColor,
      brush: separatedBrushes[index],
      points: [pointsUnited[index]],
      outlineId: window.brushUnited.outlineId,
      id: brushId,
      enclosedEgg: findEnclosedEgg(separatedBrushes[index]),
      finished: true
    };
    paperJstoTimeIds[separatedBrushes[index].id] = brushId;
    brushIds.push(brushId)
  }
  addHoverHandlers();
  window.brushUnited.remove();
  separatedBrushes = [];
  history.push({
    type: 'annotation',
    color: activeColor,
    ids: brushIds,
    brush: window.brushUnited,
    outlineId: window.brushUnited.outlineId
  });
  activeColor = randomColor();
  window.brushUnited = null;
  refreshEggClickColors();
  window.updateHighlightingText();
  updateGraphics();
}

var changeZoom = (delta, p) => {
  let oldZoom = paper.view.zoom;
  let c = paper.view.center;
  let factor = 1 + zoom;

  let zoomTemp = delta < 0 ? oldZoom * factor : oldZoom / factor;
  let beta = oldZoom / zoomTemp;
  let pc = p.subtract(c);
  let a = p.subtract(pc.multiply(beta)).subtract(c);

  return { zoom: zoomTemp, offset: a };
}

function reposition() {
  paper.view.zoom = 1;
  paper.view.center = origCenter;
  newScale = 1;
  scale();
}

var zoomInAndOut = e => {
  if (!letPictureMove) {
    return;
  }
  e.preventDefault();
  if (lastScrollTime && Date.now() - lastScrollTime < 250) {
    return;
  }
  lastScrollTime = Date.now();
  let view = paper.view;
  let viewPosition = view.viewToProject(
    new paper.Point(e.offsetX, e.offsetY)
  );

  let transform = changeZoom(e.deltaY, viewPosition);
  if (paper.view.zoom <= 1 && transform.zoom <= 1) {
    return;
  }
  if (transform.zoom < 10 && transform.zoom > 0.01) {
    newScale = 1 / transform.zoom;
    paper.view.zoom = transform.zoom;
    paper.view.center = view.center.add(transform.offset);
  }
  scale();
}

var scale = () => {
  brush.pathOptions.strokeWidth = newScale * brushScaleFactor;
  if (brush.path != null)
    brush.path.strokeWidth = newScale * brushScaleFactor;
  outlineModeWidth = newScale * outlineScaleFactor;
  updateGraphics();
}

function updateGraphics() {
  Object.values(window.oldBrushes).forEach(brush => {
    let brushColor, strokeColor;
    let isFlagged = window.gtClickPaths.length > 0 &&
      window.gtClickPaths[0].visible && !Number.isInteger(brush.enclosedEgg);
    if (isFlagged) {
      brushColor = colors.cautionYellow.clone();
      strokeColor = colors.cautionYellow.clone();
      brush.brush.opacity = 1.0;
    } else {
      brushColor = brush.color;
      strokeColor = brush.color;
      brush.brush.opacity = opacity_level;
    }
    brush.brush.selected = false;

    if (viewStyle == 'outline') {
      brush.brush.strokeWidth = outlineModeWidth;
      brush.brush.strokeColor = strokeColor;
      brush.brush.fillColor = brushColor;
      brush.brush.fillColor.alpha = 0.05;
    } else {
      brush.brush.strokeWidth = 0;
      brush.brush.fillColor = brushColor;
    }
    brush.brush.bringToFront();
  });
  if (window.brushUnited) {
    if (viewStyle == 'outline') {
      window.brushUnited.strokeWidth = outlineModeWidth;
      window.brushUnited.strokeColor = 'white';
      window.brushUnited.fillColor = 'white';
      window.brushUnited.fillColor.alpha = 0.05;
    } else {
      window.brushUnited.fillColor = activeColor;
      window.brushUnited.strokeWidth = 0;
    }
  }
}

var setPointerHandlers = () => {
  canvas.addEventListener('wheel', zoomInAndOut, { passive: false });
  window.addEventListener('pointerdown', function (evt) {
    rightClick = evt.which == 3;
  });

  paper.view.on('mousedown', function (evt) {
    if (window.blockPaperJsMouseEvents) {
      return;
    }
    let currentTime = Date.now();
    if (clickTimes.down === null || currentTime - clickTimes.down > 300) {
      clickTimes.down = currentTime;
      clickTimes.up = null;
    } else if (currentTime - clickTimes.down < 300) {
      clickTimes.down = currentTime;
    }
    pointerDown = true;
    if (keyDown.shift) {
      transformOutlineToPath();
      return;
    }
    if (editing_mode === 'annotate' && keyDown.alt) {
      editing_mode = 'erase';
    }
    if (mode == 'brush' && editing_mode !== 'delete' && !rightClick && !keyDown.shift) {
      if (editing_mode === 'annotate') {
        if (brushStrokeStartPoint) brushStrokeStartPoint.remove();
        brushStrokeStartPoint = brush.path.clone();
        brushStrokeStartPoint.visible = false;
        if (blockEdit) {
          return;
        }
        createSelection();
        draw();
      } else if (editing_mode === 'erase') {
        if (window.brushUnited) {
          brushStroke = window.brushUnited.clone();
          brushStroke.opacity = opacity_level;
          window.brushUnited.opacity = 0;
          erase();
        }
      }
    }
    timeDownUp = new Date().getTime();
    if (keyDown.shift) {
      dragStart = true;
    }
  });
  paper.view.on('mouseup', function (evt) {
    pointerDown = false;
    timeDownUp = new Date().getTime();
    let currentTime = Date.now();
    if (currentTime - clickTimes.down < 300) {
      if (clickTimes.up === null) {
        clickTimes.up = currentTime;
      } else {
        clickTimes.up = null
        return;
      }
    }
    if (mode == 'brush' && editing_mode !== 'delete' && !rightClick && !keyDown.shift) {
      let action;
      if (editing_mode === 'annotate') {
        action = 'unite';
      } else if (editing_mode === 'erase') {
        action = 'intersect';
      }
      if (editing_mode === 'erase') {
        editing_mode = 'annotate';
      }
      if (!keyDown.ctrl) {
        updateCurrentAnnotation(brushStroke, action);
        removeSelection();
      }
    }

    if (!keyDown.shift) {
      dragStart = false;
    }
    shiftKeyUsedDuringAction = false;
    rightClick = false;
    updateGraphics();
  });
}

function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

function transformOutlineToPath() {
  console.log('trying to transform outline to path');
  if (window.brushUnited) {
    window.confirmDrawnShapes();
  }
  let indexToAdd = outlineShownIndices[0];
  console.log(`index to add: ${indexToAdd}`);
  if (indexToAdd === undefined) return;
  outlineIgnoreIndices.push(indexToAdd);
  removeItemOnce(outlineShownIndices, indexToAdd);
  activeColor = outlinePaths[indexToAdd].strokeColor;
  updateCurrentAnnotation(outlinePaths[indexToAdd], 'unite', indexToAdd);
}

function makeButtonSecondary(id) {
  $(`#${id}`).removeClass('btn-primary');
  $(`#${id}`).removeClass('active');
  $(`#${id}`).addClass('btn-outline-secondary');
}

function makeButtonPrimary(id) {
  $(`#${id}`).removeClass('btn-outline-secondary');
  $(`#${id}`).addClass('btn-primary');
}

function setAnnotateMode(mode) {
  if (mode === 'delete' && $("#delete_button").hasClass("disabled")) {
    return;
  }
  editing_mode = mode;

  if (mode === 'annotate') {
    // annotate mode
    canvas.style.cursor = "none";
    makeButtonSecondary('delete_button');

    makeButtonPrimary('annotate_button');
    createBrush();
    updateGraphics();
  } else if (mode === 'delete') {
    // delete mode
    if (brush.path !== undefined) {
      brush.path.remove();
    }
    canvas.style.cursor = "pointer";
    makeButtonSecondary('annotate_button');

    makeButtonPrimary('delete_button');
    updateGraphics();
  } else if (mode === 'erase') {
    // don't remove the brush path in this case, because
    // the portions deleted will still be circular.
    makeButtonSecondary('annotate_button');
    makeButtonSecondary('delete_button');

    makeButtonPrimary('erase_button');
    canvas.style.cursor = 'none';
    createBrush();
    updateGraphics();
  }
}

var setDragHandler = () => {
  var toolPan = new paper.Tool();
  toolPan.onMouseDrag = function (evt) {
    if (!((keyDown.shift || dragStart) && letPictureMove)) {
      return;
    }
    shiftKeyUsedDuringAction = true;
    var timeMove = new Date().getTime();
    if (timeMove > timeDownUp) {
      if (dragStart) {
        var offset = new paper.Point(evt.downPoint.x - evt.point.x,
          evt.downPoint.y - evt.point.y);
        let new_center = paper.view.center.add(offset);
        paper.view.setCenter(new_center);
      }
    } else {
      timeDownUp = null;
    }
  };
}

function performBrushAction(evt) {
  if (pointerDown && !rightClick && !keyDown.ctrl &&
    !keyDown.shift && !shiftKeyUsedDuringAction && !dragStart) {
    moveBrush(evt);
    if (editing_mode === 'annotate' && !blockEdit) {
      draw();
    } else if (editing_mode === 'erase') {

      erase();
    }
  } else {
    moveBrush(evt);
    if (brushStroke) {
      brushStroke.remove();
      brushStroke = null;
    }
  }
}

var setMouseMoveHandler = () => {
  paper.view.on('mousemove', function (evt) {
    if (window.blockPaperJsMouseEvents) {
      if (brush.path) {
        brush.path.opacity = 0.0;
      }
      return;
    }
    if (brush.path) {
      brush.path.opacity = 1.0;
    }
    document.activeElement.blur();
    lastMousePosition = evt.point;
    if (mode == 'brush' && editing_mode !== 'delete') {
      if (brush.path && !brush.path.isInside(backgroundRaster.bounds)) {
        blockEdit = true;
      } else {
        blockEdit = false;
      }
      performBrushAction(evt);
    }
  });
}

var setResizeHandler = () => {
  window.onresize = () => {
    if (firstResize) {
      firstResize = false;
      return;
    }
    setCanvasWidth();
    setCanvasHeight();
  }
}

var moveBrush = function (evt) {
  if (brush.path == null) createBrush();

  brush.path.bringToFront();
  brush.path.position = evt.point;
};

var createSelection = function () {
  brushStroke = new paper.Path({
    strokeColor: brush.pathOptions.strokeColor,
    strokeWidth: brush.pathOptions.strokeWidth
  });
};

var removeSelection = function () {
  if (brushStroke != null) {
    brushStroke.remove();
    brushStroke = null;
  }
}

function erase() {
  if (!brushStroke) {
    return;
  }
  let newSelection = brushStroke.subtract(brush.path);
  brushStroke.remove();
  brushStroke = newSelection;
}

var draw = function () {
  let lastPathUnconfirmed = Boolean(window.brushUnited);
  if (lastPathUnconfirmed &&
    !window.brushUnited.bounds.contains(brushStrokeStartPoint.bounds)
    && !window.brushUnited.intersects(brushStrokeStartPoint)) {
    window.confirmDrawnShapes();
  }
  let newSelection = brushStroke.unite(brush.path);

  brushStroke.remove();
  brushStroke = newSelection;
};

function getDocumentWidth() {
  var body = document.body,
    html = document.documentElement;

  return Math.max(body.scrollWidth, body.offsetWidth,
    html.clientWidth, html.scrollWidth, html.offsetWidth);
}

function setCanvasWidth() {
  let newWidth = getDocumentWidth() -
    document.getElementById('left-panel').offsetWidth -
    document.getElementById('right-panel').offsetWidth;
  paper.view.viewSize = new paper.Size(newWidth, canvas.height);
}

function setCanvasHeight() {
  let newHeight = window.innerHeight - 100;
  paper.view.viewSize = new paper.Size(canvas.width, newHeight);
  myParent.style.height = `${newHeight}px`;
  myChild.style.height = `${newHeight}px`;
}

var renderRaster = function () {
  backgroundRaster.sendToBack();
  backgroundRaster.position = paper.view.center;
  if (backgroundRaster.height >= backgroundRaster.width) {
    backgroundRaster.scale(0.98 * canvas.height / backgroundRaster.height);
  } else {
    backgroundRaster.scale(0.98 * canvas.width / backgroundRaster.width);
  }
  pic.style.display = 'none';
  let resizedWidth = backgroundRaster.scaling.x * backgroundRaster.width;
  let resizedHt = backgroundRaster.scaling.y * backgroundRaster.height;
  imageOffset = new paper.Point(0.5 * (paper.view.size.width - resizedWidth),
    0.5 * (paper.view.size.height - resizedHt));
}

function loadEggData(dataType) {
  var urlAdded = false;
  function checkForDataUrl(urlAdded) {
    if (!urlAdded) {
      setTimeout(() => {
        urlAdded = document.getElementById(`${dataType}-json-url`).innerText;
        if (urlAdded && urlAdded.includes('ground_truth')) {
          fetchDataFromUrl(urlAdded, dataType);
        }
      }, 1000);
    }
  }
  checkForDataUrl(urlAdded);
}

var drawEggClicksOnCanvas = function () {
  window.gtClickData.forEach((click) => {
    let center = new paper.Point(click[0] * backgroundRaster.scaling.x + imageOffset.x,
      click[1] * backgroundRaster.scaling.y + imageOffset.y);
    window.gtClickPaths.push(
      new paper.Path.Circle({
        center: center,
        fillColor: colors.cautionYellow,
        radius: 2,
        opacity: 1.0,
        visible: false
      })
    );
  });
}

function revealSingleEggOutline(outlinePath) {
  outlinePath.opacity = opacity_level;
}

function hideSingleEggOutline(outlinePath) {
  outlinePath.opacity = 0;
}

function drawEggOutlinesOnCanvas() {
  outlineData.forEach((eggOutline, i) => {
    let segments = []
    eggOutline.forEach(point => {
      segments.push(new paper.Point(
        backgroundRaster.scaling.x * (point[1]) + imageOffset.x,
        backgroundRaster.scaling.y * (point[0]) + imageOffset.y
      ));
    });
    let newPath = new paper.Path({ segments, closed: true, visible: true });
    newPath.opacity = 0;
    let transparency = '0' + Math.round(255 * 5 / 100).toString(16);
    let newRandColor = randomColor();
    let newRandColorWithAlpha = `${newRandColor}${transparency}`;
    newPath.strokeColor = newRandColor;
    newPath.fillColor = newRandColorWithAlpha;
    newPath.onMouseEnter = function () {
      if (!keyDown.shift || outlineIgnoreIndices.includes(i) || outlineShownIndices.length > 0 || outlineShownIndices.includes(i)) {
        return;
      }
      outlineShownIndices.push(i);
      revealSingleEggOutline(this);
    }
    newPath.onMouseLeave = function () {
      removeItemOnce(outlineShownIndices, i);
      this.opacity = 0;

    }
    outlinePaths.push(newPath);
  });
}

var refreshEggClickColors = function () {
  window.gtClickPaths.forEach(path => {
    path.fillColor = colors.cautionYellow;
    path.opacity = 1.0;
  })
  Object.values(window.oldBrushes).forEach((brush) => {
    if (Number.isInteger(brush.enclosedEgg)) {
      window.gtClickPaths[brush.enclosedEgg].fillColor = colors.dullYellow;
      window.gtClickPaths[brush.enclosedEgg].opacity = 0;
    }
  });
}

window.numEggsWithoutAnnots = function () {
  return window.gtClickPaths.map((path) => {
    return path.fillColor._components.equals(colors.cautionYellow._components);
  }).filter(Boolean).length;
}

window.numAnnotsWithoutEggs = function () {
  return Object.values(window.oldBrushes).map((brush) => {
    return !Number.isInteger(brush.enclosedEgg);
  }).filter(Boolean).length;
}

var toggleEggClickDisplay = function () {
  refreshEggClickColors();
  if (!window.gtClickPaths[0].visible) {
    document.getElementById('show_clicks_button').style.backgroundColor = '#0354ab';
    document.getElementById('check-annots-mode-text').removeAttribute('hidden');
    reposition();
    window.updateHighlightingText();
  } else {
    document.getElementById('show_clicks_button').style.backgroundColor = '#007bff';
    document.getElementById('check-annots-mode-text').setAttribute('hidden', true);
  }
  window.gtClickPaths.forEach(path => {
    path.visible = !path.visible;
  });
  window.updateHighlightingText();
  updateGraphics();
}

var dataProcessors = {
  click: function (data) {
    window.gtClickData = JSON.parse(data);
    document.getElementById('show_clicks_button').style.display = 'block';
    drawEggClicksOnCanvas();
  }, outline: function (data) {
    outlineData = JSON.parse(data);
    drawEggOutlinesOnCanvas();
  }
};

function fetchDataFromUrl(url, dataType) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);

  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      dataProcessors[dataType](request.responseText);
    }
  };
  request.send();
}

var setupCanvas = function () {
  paper.install(window);
  paper.setup(canvas);

  setMouseMoveHandler();
  setPointerHandlers();
  setKeyboardHandlers();
  setDragHandler();
  setResizeHandler();
  // loadEggClicksData();
  loadEggData('click');
  loadEggData('outline');
  backgroundRaster = new paper.Raster('pic');
  backgroundRaster.onLoad = () => {
    setCanvasWidth();
    setCanvasHeight();
    backgroundRaster.onMouseEnter = function () {
      letPictureMove = true;
    };
    backgroundRaster.onMouseLeave = function (evt) {
      if (!backgroundRaster.bounds.contains(evt.point)) {
        letPictureMove = false;
      }
    };
    renderRaster();
    origCenter = paper.view.center;
  };
}

function undo() {
  if (history.length == 0) {
    return;
  }
  var earlierState = history.pop();
  if (history.length == 0) {
    undoButton.disabled = true;
  }
  restorePriorUnitedAnnotation(earlierState);
  refreshEggClickColors();
  window.updateHighlightingText()
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function updateInstructionText() {
  let instructionsButtons = document.getElementsByClassName('instructions-toggle');
  for (let index = 0; index < instructionsButtons.length; index++) {
    instructionsButtons[index].innerText = `${instructionsShown ? 'Hide' : 'Show'} instructions`

  }
}

function checkScriptLoadStatuses() {
  if (Object.keys(window.scriptLoadStatuses).some(k => !scriptLoadStatuses[k])) {
    document.getElementById('show-script-load-error-modal').click();
  }
}

window.getBoundsOfEggLayingArea = function () {
  let { translation, scaling } = backgroundRaster.viewMatrix;
  let bounds = backgroundRaster.internalBounds;
  let canvas = document.getElementById('myCanvas');
  let x1 = translation.x - 0.5 * bounds.width * scaling.x;
  let y1 = translation.y - 0.5 * bounds.height * scaling.y;
  let x2 = translation.x + 0.5 * bounds.width * scaling.x;
  let y2 = translation.y + 0.5 * bounds.height * scaling.y;
  if (x1 < 0) {
    x1 = 0;
  }
  if (y1 < 0) {
    y1 = 0;
  }
  if (x2 > canvas.width) {
    x2 = canvas.width;
  }
  if (y2 > canvas.height) {
    y2 = canvas.height;
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

var start = function () {
  setTimeout(() => {
    checkScriptLoadStatuses();
  }, 10000);
  $(document).on('hidden.bs.modal', '#annotationCountWarningModal', function () {
    if (window.gtClickPaths.length > 0 && !window.gtClickPaths[0].visible) {
      document.getElementById('show_clicks_button').click();
    }
    document.getElementById('reposition_button').click();
  });
  $(document).on('hidden.bs.modal', '#reportBugModal', () => {
    window.blockPaperJsKeyEvents = false;
    document.removeEventListener('mousemove', window.paperJsMouseMoveBlocker);
  })
  myParent = document.getElementById("editorOuter");
  myChild = document.getElementById("editorInner");
  canvas = document.getElementById("myCanvas");
  pic = document.getElementById('pic')
  ctx = canvas.getContext("2d");
  activeColor = randomColor();
  if (pic.complete) {
    setupCanvas();
  } else {
    $('#pic').one('load', function () {
      setupCanvas();
    });
  }
  modeButton = document.getElementById("mode_button");
  viewButton = document.getElementById("view_button");
  canvas.style.cursor = "none";

  let instructionsButtons = document.getElementsByClassName('instructions-toggle');
  for (let index = 0; index < instructionsButtons.length; index++) {
    instructionsButtons[index].onclick = function () {
      $('#instruction').clearQueue();
      $('#instruction').slideToggle();
      instructionsShown = !instructionsShown;
      updateInstructionText();
    }
  }
  // $('#title').click(function () {
  //   $('#instruction').clearQueue();
  //   $('#instruction').slideToggle();
  //   instructionsShown = !instructionsShown;
  //   updateInstructionText()
  // });
  if (localStorage.getItem('visited') !== 'true') {
    $('#instruction').slideDown(1000);
    instructionsShown = true;
  } else {
    $('#instruction').slideUp(2);
    instructionsShown = false;
  }
  updateInstructionText();
  setTimeout(() => {
    localStorage.setItem('visited', true);
  }, 2000);


  window.annotations = {};
  let mode_data = "brush";
  modes = mode_data.split('-');
  mode = modes[0];
  modeButton.value = 'Mode: ' + capitalize(mode);

  // generate select list options
  classSelection = document.getElementById("object-class");
  var classes_data = "${classes}";
  if (classes_data == ("$" + "{classes}")) // running in local demo mode
  {
    classes_data = "egg";
  }
  let classes = classes_data.split('-');

  // populate list items and generate unique colors based on string hash
  classes.forEach((theClass) => {
    var option = document.createElement("option");
    option.innerHTML = theClass;
    classSelection.appendChild(option);
  });

  classSelection.size = Math.min(10, classes.length);
  classSelection.selectedIndex = 0;
  updateGraphics();

  let savedViewStyle = localStorage.getItem('annotationViewStyle');
  if (savedViewStyle) {
    if (viewStyles.indexOf(savedViewStyle) !== -1) {
      viewStyleNum = viewStyles.indexOf(savedViewStyle);
    }
  }
  viewStyle = viewStyles[viewStyleNum];
  setViewButtonVal();

  //initialize sliders
  let savedOpacity = localStorage.getItem('opacity');
  var opacitySlider = new Slider('#opacity_slider', {
    formatter: function (value) {
      return 'Value: ' + value;
    }
  }).on('slide', function () {
    opacity_level = opacitySlider.getValue() / 100.0;
    if (window.brushUnited) {
      window.brushUnited.opacity = opacity_level;
    }
    localStorage.setItem('opacity', opacity_level);
    updateGraphics();
  });
  if (savedOpacity) {
    opacitySlider.setValue(`${savedOpacity * 100}`);
  } else {
    opacitySlider.setValue(`${opacity_level * 100}`);
  }
  var brushRadSlider = new Slider('#brush_rad_slider', {
    formatter: function (value) {
      return 'Value: ' + value;
    },
  }).on('slide', function () {
    brush.pathOptions.radius = brushRadSlider.getValue();
    createBrush();
    localStorage.setItem('brushRad', brush.pathOptions.radius);
  });
  let savedBrushRad = localStorage.getItem('brushRad');
  if (savedBrushRad) {
    savedBrushRad = parseInt(savedBrushRad, 10)
    if (savedBrushRad >= parseInt(brushRadSlider.max, 10)) {
      savedBrushRad = brushRadSlider.max;
    } else if (savedBrushRad <= parseInt(brushRadSlider.min, 10)) {
      savedBrushRad = brushRadSlider.min;
    }
    brushRadSlider.setValue(savedBrushRad);
    brush.pathOptions.radius = brushRadSlider.getValue();
  } else {
    brushRadSlider.setValue(brush.pathOptions.radius);
  }

  //initialize buttons
  $("#reset_button").click(reset);
  $('#show_clicks_button').click(toggleEggClickDisplay);
  $("#undo_button").click(undo)
  $("#reposition_button").click(reposition);
  $("#view_button").click(toggleView);
  $("#mode_button").click(toggleMode);
  $("#delete_button").click(() => {
    setAnnotateMode('delete');
  });
  $("#annotate_button").click(() => {
    setAnnotateMode('annotate');
  });
  undoButton = document.getElementById('undo_button');
  undoButton.disabled = true;

  // disable right click context menu on canvas
  canvas.oncontextmenu = function () {
    return false;
  }

  canvas.addEventListener('mouseout', function () {
    dragStart = false;
  });

  function reset() {
    clearAnnotations();
    reposition();
    dragStart = false;
    setDeleteMode(false);
  }

  function clearAnnotations() {
    Object.values(window.oldBrushes).forEach(brush => {
      brush.brush.remove();
    })
    window.oldBrushes = {};
    if (window.brushUnited) {
      window.brushUnited.remove();
      window.brushUnited = null;
    }
  }
  window.scriptLoadStatuses.turkey = true;
}

start();
