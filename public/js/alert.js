// The arrival sound is generated in the browser, so there is no audio file to load.
// Browsers block audio until the page has been interacted with, so the audio
// context is unlocked by the first click or keypress on the dashboard.
let context = null;

function unlockAudio() {
  try {
    if (!context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      context = new AudioCtor();
    }
    if (context.state === 'suspended') context.resume();
  } catch {
    context = null;
  }
}

document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', unlockAudio);

// Two soft chimes, rising: distinct enough to notice, calm enough for the style.
function playArrivalAlert() {
  if (!context) return;
  if (context.state === 'suspended') context.resume();

  const start = context.currentTime;
  [880, 1174].forEach((frequency, index) => {
    const at = start + index * 0.18;
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);

    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + 0.45);
  });
}
