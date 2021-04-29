document.getElementById("external-instructions").onclick = () => {
    var newWin = window.parent.parent.open("", "Instructions", "resizable,height=600,width=800");
    var instructionsHtml = document.getElementById("instruction").innerHTML;
    newWin.document.body.style.marginLeft = "10px";
    newWin.document.body.innerHTML = instructionsHtml;
    newWin.document.title = "Instructions";
    let newBootstrap = document.getElementById("bootstrap-css").cloneNode();
    newWin.document.body.appendChild(newBootstrap);
};