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

  function onWorkerReady(event) {
    if (event.data.type === 'ack') {
      this.removeEventListener('message', onWorkerReady);
      this.ready = true;
      self.maybeDequeueJob();
    }
  }

  var worker;
  for (var i=0; i<workerCount; i++) {
    worker = this.createWorker(optiosn.workerPath, options.iframePath);
    worker.running = false;
    worker.ready = false;
    worker.addEventListener('message', onWorkerReady);
    this.workers[i] = worker;
  }
}

/**
 * @param {string} workerPath
 * @param {string} iframePath
 * @return {Worker|IframeElement}
 */
WorkerPool.prototype.createWorker = function (workerPath, iframePath) {
  if (typeof Worker === 'function') {
    return new Worker(workerPath);
  }

  var iframe = document.createElement('iframe');
  iframe.height = iframe.width = 0;
  iframe.src = iframePath;
  raf(function () {
    document.body.appendChild(iframe);
  });
  return iframe;
};

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
    var currentWorker = this.workers[index];
    currentWorker.removeEventListener('message', onMessage);
    currentWorker.running = false;
    job[1](event);
    this.maybeDequeueJob();
  }.bind(this, i);

  availableWorker.running = true;
  availableWorker.addEventListener('message', onMessage);
  availableWorker.postMessage(job[0]);
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
