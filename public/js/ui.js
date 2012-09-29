/*=========================================================== 

  Used to build and render the UI 

===========================================================*/

// Sets the content's height according to the windows
function resize() {
  // Resize the main viewport
  $("#content").height(
    $(window).height() - $("#header").height() - $("#footer").height() - 35
  );

  // Resize the message scroller
  $("#messagebox").height(
    $("#content").height()
  );
}

// Apply the rules on ready and with each resize
$(document).ready(function() {
  resize();

  $(window).resize(function() {
    resize();
  });
});