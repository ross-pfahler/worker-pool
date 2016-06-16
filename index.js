var raf = require('./dom').raf;

/**
 * Shared webworkers pool.
 * Spins up n number of workers and distributes a work queue based on
 * availablity of the workers.
 *
 * @param {Object} options
 * @param {number} options.workerCount
 * @param {string} options.workerPath
 * @param {string} options.iframePath
 * @constructor
 */
function WorkerPool(options) {
  this.workers = Array(options.workerCount);
  this.queuedJobs = [];
  var self = this;

  /**
   * @param {string} workerPath
   * @param {string} iframePath
   * @param {function} onWorkerReady
   * @return {Worker|IframeElement}
   */
  function createWorker(workerPath, iframePath, onWorkerReady) {
    if (typeof Worker === 'function') {
      var worker = new Worker(workerPath);
      worker.onWorkerReady = onWorkerReady.bind(null, worker);
      worker.addEventListener('message', worker.onWorkerReady);
      return worker;
    }

    var iframe = document.createElement('iframe');
    iframe.height = iframe.width = 0;
    iframe.onWorkerReady = onWorkerReady.bind(null, iframe);
    window.addEventListener('message', iframe.onWorkerReady, false);
    iframe.src = iframePath;
    raf(function () {
      document.body.appendChild(iframe);
    });
    return iframe;
  }

  function onWorkerReady(worker, event) {
    var data = event.data;
    try {
      data = JSON.parse(data);
    } catch (e) {
      // noop
    }

    if (data.type === 'ack') {
      if (typeof Worker === 'function') {
        worker.removeEventListener('message', worker.onWorkerReady);
      } else {
        window.removeEventListener('message', worker.onWorkerReady);
      }
      worker.ready = true;
      self.maybeDequeueJob();
    }
  }

  var worker;
  for (var i=0; i<options.workerCount; i++) {
    worker = createWorker(options.workerPath, options.iframePath, onWorkerReady);
    worker.running = false;
    worker.ready = false;
    this.workers[i] = worker;
  }
}

/**
 * @param {Object} data
 * @param {funtion()} callback
 */
WorkerPool.prototype.queueJob = function (data, callback) {
  this.queuedJobs.push([data, callback]);
  this.maybeDequeueJob();
};

/**
 * Possibly dequeues a job (if there are available workers)
 */
WorkerPool.prototype.maybeDequeueJob = function () {
  var availableWorker;

  for (var i=0; i<this.workers.length; i++) {
    if (!this.workers[i].running && this.workers[i].ready) {
      availableWorker = this.workers[i];
      break;
    }
  }

  if (!availableWorker || !this.queuedJobs.length) {
    return;
  }

  var job = this.queuedJobs.shift();
  /**
   * @param {number} index
   * @param {Event} event
   */
  var onMessage = function (index, event) {
    var data = event.data;
    try {
      data = JSON.parse(data);
    } catch (e) {
      // noop
    }

    var currentWorker = this.workers[index];
    if (typeof Worker === 'function') {
      currentWorker.removeEventListener('message', onMessage);
    } else {
      window.removeEventListener('message', onMessage);
    }

    currentWorker.running = false;
    job[1]({data: data});
    this.maybeDequeueJob();
  }.bind(this, i);

  availableWorker.running = true;

  var jobData = JSON.stringify(job[0]);
  if (typeof Worker === 'function') {
    availableWorker.addEventListener('message', onMessage);
    availableWorker.postMessage(jobData);
  } else {
    window.addEventListener('message', onMessage, false);
    availableWorker.contentWindow.postMessage(jobData, '*');
  }
};

/**
 * Destroys the workers
 */
WorkerPool.prototype.destroy = function () {
  this.queuedJobs = [];
  this.workers.forEach(function (worker) {
    if (worker.terminate) {
      worker.terminate();
    } else {
      worker.parentElement.removeChild(worker);
    }
  });
  this.workers = [];
};

module.exports = WorkerPool;
