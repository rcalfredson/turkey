var instructionsShown = true;
var numWarningsShown = 0;
var submitBlocked = false;
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
function toggleAnnotationCheckMode() {
    document.getElementById('show_clicks_button').click();
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
            `${includeMaxima ?  ` (${accuracyThreshold} allowed)` : ''}`;
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
        accuracyThreshold = Math.round(numEggs * 0.05);
    }
    let numOrphanedEggs = window.numEggsWithoutAnnots();
    let numOrphanedAnnots = window.numAnnotsWithoutEggs();
    if (numOrphanedEggs === 0 && numOrphanedAnnots === 0) {
        return;
    }
    let atLeastOneCountOverThreshold = numOrphanedEggs > accuracyThreshold || numOrphanedAnnots > accuracyThreshold;
    document.getElementById('egg-discrepancy-description').innerText = getDescriptionOfEggMismatches(
        numOrphanedEggs, numOrphanedAnnots, accuracyThreshold, atLeastOneCountOverThreshold)
    if (!atLeastOneCountOverThreshold) {
        // show the warning
        document.getElementById('annotationCountWarningModalLabel').innerText = 'Warning';
        document.getElementById('annotationWarningDismissButton').innerText = 'Cancel';
        document.getElementById("submit-from-modal").removeAttribute("hidden");
        document.getElementById("egg-discrepancy-request").innerText = 'Please cancel to check your annotations or, if you have checked already, submit anyway.'
        document.getElementById("show-annotation-count-warning-modal").click();
        submitBlocked = true;
    } else if (atLeastOneCountOverThreshold) {
        document.getElementById('annotationCountWarningModalLabel').innerText = 'Error';
        numWarningsShown = 0;
        submitBlocked = true;
        document.getElementById("egg-discrepancy-request").innerText = `Please correct your annotations.`;
        document.getElementById("submit-from-modal").setAttribute("hidden", true);
        document.getElementById("show-annotation-count-warning-modal").click();
    }
}

var s3Split = document.getElementById('pic').getAttribute('src').split("s3://");
var imagesSplit = s3Split[s3Split.length - 1].split("egg-laying/images/");
var extensionSplit = imagesSplit[imagesSplit.length - 1].replace(/\.[^/.]+$/, "");
var click_data_url = `https://egg-laying.s3.us-east-2.amazonaws.com/ground_truth_clicks/${extensionSplit}_clicks.json`;
document.getElementById("click-json-url").innerText = click_data_url;
document.getElementById("submit-from-modal").onclick = () => {
    submitBlocked = false;
    completeSubmit(true);
};
var completeSubmit = function (skipChecks = false) {
    if (window.brushUnited) {
        document.getElementById("show-unfinished-annotations-modal").click();
        return;
    }
    if (!skipChecks) {
        checkForClickDisagreement();
    }
    if (submitBlocked) {
        return;
    }
    window.parent.document.getElementById("annotations").value = JSON.stringify(Object.values(window.oldBrushes).map(brush => {
        delete brush.brush;
        return brush;
    }));
    window.parent.document.getElementById("hiddenSubmit").click();
}
document.getElementById("submitButton").onclick = function () {
    completeSubmit()
};

