var slideIndex = [1, 1, 1];

showSlides(slideIndex, 0);
showSlides(slideIndex, 1);

// Next/previous controls
function plusSlides(n, slide) {

  showSlides(slideIndex[slide] += n, slide);
}

// Thumbnail image controls
function currentSlide(n, slide) {
  showSlides(slideIndex[slide] = n, slide);
}

function showSlides(n, slide) {
  var i;

  var slides = ["mySlides", "mySlidesExp", "mySlidesPort"];
  var dots   = ["dot", "dotExp", "dotPort"];

  var s = document.getElementsByClassName(slides[slide]);
  var d = document.getElementsByClassName(dots[slide]);

  if (n > s.length) {slideIndex[slide] = 1}
  if (n < 1) {slideIndex[slide] = s.length}
  for (i = 0; i < s.length; i++) {
      s[i].style.display = "none";
  }
  for (i = 0; i < d.length; i++) {
      d[i].className = d[i].className.replace(" active", "");
  }
  //s[slideIndex[slide]-1].style.display = "block";
  //d[slideIndex[slide]-1].className += " active";
}