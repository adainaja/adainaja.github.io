const splash=document.getElementById("splash");
const progressBar=document.getElementById("loadingProgress");
const progressText=document.getElementById("loadingPercent");
const skipButton=document.getElementById("skipButton");

const HOME_PAGE="home.html";
const DURATION=2600;
const START_TIME=performance.now();
let leaving=false;

function goToHome(){
  if(leaving)return;
  leaving=true;
  splash.classList.add("is-leaving");
  window.setTimeout(()=>window.location.replace(HOME_PAGE),420);
}

function animateProgress(now){
  const progress=Math.min(100,Math.round(((now-START_TIME)/DURATION)*100));
  progressBar.style.width=progress+"%";
  progressText.textContent=progress+"%";
  if(progress<100){requestAnimationFrame(animateProgress);return;}
  window.setTimeout(goToHome,180);
}

skipButton.addEventListener("click",goToHome);
requestAnimationFrame(animateProgress);
