var instructionsShown = true;
var numWarningsShown = 0;
var submitBlocked = false;
var canvasAfterCrop;
function toggleInstructions() {
    instructionsShown = !instructionsShown;
    if (instructionsShown) {
        document.getElementById("shortcuts-toggle").innerText = "hide";
        document.getElementById("shortcuts-table").style.opacity = 1.0;
    }
    else {
        document.getElementById("shortcuts-toggle").innerText = "show";
        document.getElementById("shortcuts-table").style.opacity = 0;
    }
}
window.updateHighlightingText = function () {
    let numOrphanedEggs = window.numEggsWithoutAnnots();
    let numOrphanedAnnots = window.numAnnotsWithoutEggs();
    let highlightDescrText = ''
    if (numOrphanedEggs === 0 && numOrphanedAnnots === 0) {
        highlightDescrText = 'Your annotations fully match our egg position data.';
        document.getElementById('highlighting-disclaimer').setAttribute('hidden', true);
        document.getElementById('check-mode-toggle-parent').setAttribute('hidden', true);
    } else {
        document.getElementById('check-mode-toggle-parent').removeAttribute('hidden');
        highlightDescrText = 'Highlighting ';
        let eggDesc = 'eggs missing annotations';

        document.getElementById('highlighting-disclaimer').removeAttribute('hidden');
        let annotDesc = 'annotations in areas without eggs (uncalled-for annotations)';
        if (numOrphanedEggs > 0 && numOrphanedAnnots > 0) {
            highlightDescrText += `${eggDesc} and ${annotDesc}`;
        }
        else if (numOrphanedEggs === 0) {
            highlightDescrText += annotDesc;
        }
        else if (numOrphanedAnnots === 0) {
            highlightDescrText += eggDesc;
        }
        highlightDescrText += '.';
    }
    document.getElementById('highlighting-desc').innerText = highlightDescrText;
};
function toggleAnnotationCheckMode() {
    document.getElementById('show_clicks_button').click();
    window.updateHighlightingText();
}


function toggleMouseOver(buttonName) {
    window.blockPaperJsMouseEvents = true;
    document.getElementById(buttonName).focus();
}

let toggleButtonNames = ['shortcuts-toggle',
    'check-mode-toggle-text'];
let toggleActions = [toggleInstructions, toggleAnnotationCheckMode];
toggleButtonNames.forEach((buttonName, i) => {
    let toggleButton = document.getElementById(buttonName);
    toggleButton.onmouseover = () => { toggleMouseOver(buttonName) };
    toggleButton.onmouseout = () => {
        window.blockPaperJsMouseEvents = false;
        document.activeElement.blur();
    };
    toggleButton.onclick = toggleActions[i];
});

function getDescriptionOfEggMismatches(numOrphanedEggs, numOrphanedAnnots, accuracyThreshold, includeMaxima) {
    function getVerb(isPlural) {
        return `${isPlural ? 'are' : 'is'} `;
    }
    function pluralize(noun, isPlural) {
        return `${noun}${isPlural ? 's' : ''}`;
    }
    let output = '';
    if (numOrphanedEggs > 0) {
        let isPlural = numOrphanedEggs > 1;
        output += getVerb(isPlural);
        output += `${numOrphanedEggs} missing ${pluralize('annotation', isPlural)}${includeMaxima ? ` (${accuracyThreshold} allowed)` : ''}`;
    }
    if (numOrphanedAnnots > 0) {
        let isPlural = numOrphanedAnnots > 1;
        if (output.length > 0) {
            output += ' and ';
        } else {
            output += getVerb(isPlural)
        }
        output += `${numOrphanedAnnots} uncalled-for ${pluralize('annotation', isPlural)}` +
            `${includeMaxima ? ` (${accuracyThreshold} allowed)` : ''}`;
    }
    if (output.length > 0) {
        output += '.'
    }
    return output
}

function checkForClickDisagreement() {
    if (!window.gtClickData) {
        return;
    }
    let numEggs = window.gtClickData.length;
    let accuracyThreshold;
    if (numEggs <= 10) {
        accuracyThreshold = 1;
    } else if (numEggs > 10 && numEggs < 41) {
        accuracyThreshold = 2;
    } else {
        accuracyThreshold = Math.ceil(numEggs * 0.05);
    }
    let numOrphanedEggs = window.numEggsWithoutAnnots();
    let numOrphanedAnnots = window.numAnnotsWithoutEggs();
    if (numOrphanedEggs === 0 && numOrphanedAnnots === 0) {
        submitBlocked = false;
        return;
    }
    let atLeastOneCountOverThreshold = numOrphanedEggs > accuracyThreshold || numOrphanedAnnots > accuracyThreshold;
    document.getElementById('egg-discrepancy-description').innerText = getDescriptionOfEggMismatches(
        numOrphanedEggs, numOrphanedAnnots, accuracyThreshold, atLeastOneCountOverThreshold)
    if (!atLeastOneCountOverThreshold) {
        // show the warning
        document.getElementById('annotationCountWarningModalLabel').innerText = 'Warning';
        document.getElementById('annotationWarningDismissButton').innerText = 'Cancel';
        document.getElementById("submit-inside-warning-modal").removeAttribute("hidden");
        document.getElementById("egg-discrepancy-request").innerText = 'Please cancel to check your annotations or, if you have checked already, submit anyway.'
        document.getElementById("show-annotation-count-warning-modal").click();
        submitBlocked = true;
    } else if (atLeastOneCountOverThreshold) {
        document.getElementById('annotationCountWarningModalLabel').innerText = 'Error';
        document.getElementById('annotationWarningDismissButton').innerText = 'OK';
        numWarningsShown = 0;
        submitBlocked = true;
        document.getElementById("egg-discrepancy-request").innerText = `Please correct your annotations.`;
        document.getElementById("submit-inside-warning-modal").setAttribute("hidden", true);
        document.getElementById("show-annotation-count-warning-modal").click();
    }
}

var s3Split = document.getElementById('pic').getAttribute('src').split("s3://");
var imagesSplit = s3Split[s3Split.length - 1].split("egg-laying/images/");
var extensionSplit = imagesSplit[imagesSplit.length - 1].replace(/\.[^/.]+$/, "");
var click_data_url = `https://egg-laying.s3.us-east-2.amazonaws.com/ground_truth_clicks/${extensionSplit}_clicks.json`;
document.getElementById("click-json-url").innerText = click_data_url;
let submitButtons = document.getElementsByClassName('submit-from-modal');
  for (let index = 0; index < submitButtons.length; index++) {
    submitButtons[index].onclick = () => {
        submitBlocked = false;
        completeSubmit();
    }

  }
const cropCanvas = (sourceCanvas, left, top, width, height) => {
    let destCanvas = document.createElement('canvas');
    destCanvas.width = width;
    destCanvas.height = height;
    destCanvas.getContext("2d").drawImage(
        sourceCanvas,
        left, top, width, height,  // source rect with content to crop
        0, 0, width, height);      // newCanvas, same size as source rect
    return destCanvas;
}
document.getElementById('report_bug_button').onclick = () => {
    document.getElementById('show-bug-report-modal').click();
    window.blockPaperJsKeyEvents = true;
    let eggLayingBounds = window.getBoundsOfEggLayingArea();
    canvasAfterCrop = cropCanvas(
        document.getElementById('myCanvas'), eggLayingBounds.x, eggLayingBounds.y, eggLayingBounds.width, eggLayingBounds.height
    )
    document.getElementById('screenshot-preview').setAttribute('src', canvasAfterCrop.toDataURL('image/jpeg'));
    window.paperJsMouseMoveBlocker = document.addEventListener('mousemove', (event) => {
        document.getElementById('bug-summary-input').focus();
    })
};
document.getElementById('bugReportSubmit').onclick = () => {
    window.parent.document.getElementById('bug-comments').value = document.getElementById('bug-summary-input').value;
    window.parent.document.getElementById('bug-screenshot').value = canvasAfterCrop.toDataURL('image/jpeg');
    window.parent.document.getElementById('hiddenSubmit').click();
}
var completeSubmit = function () {
    window.parent.document.getElementById("annotations").value = JSON.stringify(Object.values(window.oldBrushes).map(brush => {
        delete brush.brush;
        return brush;
    }));
    window.parent.document.getElementById("hiddenSubmit").click();
}
var checkBeforeSubmit = function (skipChecks = false) {
    if (window.brushUnited) {
        window.confirmDrawnShapes();
    }
    if (!skipChecks) {
        checkForClickDisagreement();
    }
    if (submitBlocked) {
        return;
    }
    document.getElementById('show-confirm-submit-modal').click();
}
document.getElementById("submitButton").onclick = function () {
    checkBeforeSubmit();
};
window.scriptLoadStatuses.helpers = true;
