const WORKER_PATH = 'recorderWorkerMP3.js';

const Recorder = function(source, cfg){
  const config = cfg || {};
  const bufferLen = config.bufferLen || 4096;
  this.context = source.context;
  this.node = (
    this.context.createScriptProcessor ||
    this.context.createJavaScriptNode
  ).call(this.context, bufferLen, 2, 2);
  const worker = new Worker(config.workerPath || WORKER_PATH);
  worker.postMessage({
    command: 'init',
    config: {
      sampleRate: this.context.sampleRate
    }
  });
  let recording = false;
  let currCallback;

  this.node.onaudioprocess = function(event){
    if (!recording) return;
    worker.postMessage({
      command: 'record',
      buffer: [
        event.inputBuffer.getChannelData(0),
        event.inputBuffer.getChannelData(1)
      ]
    });
  }

  this.configure = function(options){
    Object.keys(options).forEach((prop) => {
      if (options.hasOwnProperty(prop)){
        config[prop] = options[prop];
      }
    });
  }

  this.record = function(){
    recording = true;
  }

  this.stop = function(){
    recording = false;
  }

  this.clear = function(){
    worker.postMessage({ command: 'clear' });
  }

  this.getBuffer = function(cb) {
    currCallback = cb || config.callback;
    worker.postMessage({ command: 'getBuffer' })
  }

  this.exportAudio = function(cb, type) {
    currCallback = cb || config.callback;
    type = type || config.type || 'audio/wav';
    if (!currCallback) throw new Error('Callback not set');
    worker.postMessage({
      command: 'exportAudio',
      type: type
    });
  }

  worker.onmessage = function(e) {
    var blob = e.data;
    currCallback(blob);
  }

  source.connect(this.node);
  this.node.connect(this.context.destination);    //this should not be necessary
};

Recorder.forceDownload = function(blob, filename){
  var url = (window.URL || window.webkitURL).createObjectURL(blob);
  var link = window.document.createElement('a');
  link.href = url;
  link.download = filename || 'output.wav';
  var click = document.createEvent("Event");
  click.initEvent("click", true, true);
  link.dispatchEvent(click);
}

export default Recorder;
