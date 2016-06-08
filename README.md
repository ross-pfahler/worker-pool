# Worker Pool

Pooling and Queuing of jobs for Web Workers

## Usage

```javascript
var path = 'path/to/a/web/worker.js';
var pool = new WorkerPool(2, path);
pool.queueJob({
  type: 'analyze',
  value1: 'a',
  value2: 'b'
}, function (event) {
  console.log(event.data);
});
```

Workers must send an 'ack' message upon successful instantiation. Usually, this can just be
at the end of the worker file. For example:

```javascript
self.onMessage = function (event) {
  // Do work
};

 self.postMessage({type: 'ack'});
```

## License
ISC
