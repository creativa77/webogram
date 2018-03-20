/**
 * Immedia Snapshots
 *
 * This component will draw to the provided canvas spapshots taken from the video. It does face tracking.
 *
 * Dependencies:
 *  - jQuery (http://jquery.com/) - MIT License
 *  - headtrackr library (https://www.github.com/auduno/headtrackr/) - MIT License
 *
 * Usage:
 *
 * var video = document.getElementById('inputVideo');
 * var canvas = document.getElementById('targetCanvas');
 *
 * var tracker = new ImmediaTracker(video, canvas, {snapshotInterval:1000, useFaceTracking: true, showDebugMarkers:false});
 * tracker.start();
 *
**/

function ImmediaTracker(video, canvas, options) {
  this.options = $.extend(
    {
	      snapshotInterval: 500, //Interval in which snapshots are taken and displayed
        useFaceTracking: true,
        startWithFaceTracking: true,
        showDebugMarkers: false,
        detectionInterval: 300, //Interval between face tracking attemps. Faster detections consume more CPU, but allow a more responsive behaviour
                                //from the component ( i.e: finding a face, realizing it has lost a face, etc )
        snoozeImageUrl: "/app/immedia-resources/snooze.png",
        sizeRatio: 1.3, //Allows to resize the box found by the face tracker. Defaults to 1.3, for a 30% increase
        snoozeReleaseTime : 20000, //The time the snooze will last before it tries to regain control of the camera
        snoozeRetryInterval : 2000 //The time the snooze will wait before retrying to

  }, options || {});

  this._targetRatio = canvas.width / canvas.height;
  this._face_tracking = this.options.useFaceTracking && this.options.startWithFaceTracking;
  this.video = video;
  this.canvas = canvas;
  this.context = canvas.getContext('2d');
  this._snoozed = false;
  this._snoozeImage = new Image;
  this._snoozeImage.src = this.options.snoozeImageUrl;

  console.log("Target canvas is: " + canvas.width + "x" + canvas.height + " - Target ratio: " + this._targetRatio);

  if ( this.options.useFaceTracking ) {
    this.trackerCanvas = $("<canvas width='320' height='240'></canvas>")[0];
    this.tmpCanvas = $("<canvas width='" + canvas.width + "' height='" + canvas.height + "'></canvas>")[0];
    this.tmpContext = this.tmpCanvas.getContext("2d");

    this.htracker = new headtrackr.Tracker({
      ui: false,
      headPosition: false,
      detectionInterval: this.options.detectionInterval
    });

    $(document).on('headtrackrStatus',  $.proxy(this.handleHtStatus,this));
    $(document).on('facetrackingEvent', $.proxy(this.handleFtStatus,this));

    if ( this.options.showDebugMarkers ) {
      var div = $("<div style='position:absolute;right:20px;top:170px;'></div>");
      div.append(this.trackerCanvas);

      $('body').append(div);

      this.trackerContext = this.trackerCanvas.getContext('2d');
    }
  } else {
    if ( this.options.showDebugMarkers ) {
      this.options.showDebugMarkers = false;
      console.log("Disabled showDebugMarkers as there is no face tracking");
    }
  }

  var obj = this;

  video.addEventListener('playing', function() {
    if (this.videoWidth === 0) {
      console.error('videoWidth is 0. Camera not connected?');
    } else {
      obj.videoWidth = this.videoWidth;
      obj.videoHeight = this.videoHeight;

      console.log("Source video is : " + obj.videoWidth + "x" + obj.videoHeight );
    }
  }, false);

};

ImmediaTracker.prototype._drawDebugRect = function(x,y,w,h,color) {
  if (! this.trackerContext ) {
    return;
  }
  this.trackerContext.beginPath();
  this.trackerContext.lineWidth="2";
  this.trackerContext.strokeStyle=color;
  this.trackerContext.rect(Math.max(0,x),Math.max(0,y),w,h);
  this.trackerContext.stroke();
};

ImmediaTracker.prototype.handleFtStatus = function(event) {
  event = event.originalEvent;
  //If there is no face being tracked, we don't care about this event ( anyway, there shouldn't be such events if there is no face being tracked )
  if (! this._found ) {
    return;
  }
  var w = event.width;
  var h = event.height;
  var w1 = w * this.options.sizeRatio;
  var h1 = h * this.options.sizeRatio;
  var h2 = h1;
  var w2 = h2 * this._targetRatio;
  var x2 = Math.min(this.trackerCanvas.width-w2, Math.max(0, event.x - w2/2));
  var y2 = Math.min(this.trackerCanvas.height-h2, Math.max(0, event.y - h2/2));

  if ( this.options.showDebugMarkers ) {
    this.trackerContext.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight, 0, 0, this.trackerCanvas.width, this.trackerCanvas.height);
    this._drawDebugRect(event.x - w/2, event.y - h/2, w, h, "red");
    this._drawDebugRect( event.x - w1/2, event.y - h1/2 , w1, h1, "yellow");
    this._drawDebugRect( x2, y2, w2, h2, "green");
  }

  //FIXME: Review this thoroughly. This may not always work, depending on the aspect ratio of the video ( I think ). Should harden this. GM.
  //headtracker internally uses a 320w or 240h video, so the results are based on that
  x2 = (x2 / this.trackerCanvas.width) * this.videoWidth;
  y2 = (y2 / this.trackerCanvas.height) * this.videoHeight;
  w2 = (w2 / this.trackerCanvas.width) * this.videoWidth;
  h2 = (h2 / this.trackerCanvas.height) * this.videoHeight;

  //TODO: Is it correct to scale here? we are doing this on every 'facetrackingEvent' but actually showing it every 'snapshotInterval'

  //Save tracked snapshot for future use
  this.tmpContext.drawImage(this.video, x2, y2, w2, h2, 0, 0, this.tmpCanvas.width, this.tmpCanvas.height);
  this.lastDynamicSnapshot = this.tmpContext.getImageData(0,0, this.tmpCanvas.width, this.tmpCanvas.height);
};

ImmediaTracker.prototype.handleHtStatus = function(event) {
  event = event.originalEvent;
  if ( this.lastStatus == event.status ) {
    return;
  }
  this.lastStatus = event.status;
  console.debug("HeadTrack Status: " + this.lastStatus);
  if ( event.status == "found" ) {
    this.setFound(true);
  } else if ( event.status == "detecting" || event.status == "redetecting" || event.status == "whitebalance" || event.status == "hints" ) {
    this.setFound(false);
  } else if ( event.status == "stopped" ) { //Could this change the "user status" to "Busy?"
    this.setFound(false);
  } else {
    //Unknown state
    console.log("Unknown HeadTrack status", event);
  }
};

ImmediaTracker.prototype.setFound = function(found /*boolean*/) {
  if ( this._found === found ) {
    return;
  }
  console.debug("found: " + found);
  //TODO: fire away/back event
  this._found = found;

  if (! this._found ) {
    this.lastDynamicSnapshot = null;
  }
};

ImmediaTracker.prototype.start = function(err, callback) {
    console.log("Start generating snapshots every " + this.options.snapshotInterval + "ms");

    var obj = this;
    // Get camera stream size
    $(document).on("playing", function() {
      obj.videoWidth = this.videoWidth;
      obj.videoHeight = this.videoHeight;
      console.log("Video source size: " + obj.videoWidth + "x" + obj.videoHeight);
    }, false);

    var errClbk = (typeof err === "function" )?err:function(error) { console.log("Failed to obtain user media",error); };

    this.startUserMedia(errClbk, callback);
};

ImmediaTracker.prototype.startUserMedia = function(err, callback) {
  navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

  var cbk = $.proxy(function(stream) {
     this.setStream(stream);
     if ( typeof callback == "function" ) {
       callback();
     }
  }, this);

  if (navigator.getUserMedia) {
    navigator.getUserMedia({ video: true }, cbk, err);
  } else {
    err(new Error("There is no user media"));
  }
};


ImmediaTracker.prototype.setStream = function(stream) {
  this.stream = stream;

  this.video.src = window.URL.createObjectURL(stream);

  console.log("Video started...");

  //Start taking snapshots ASAP
  this.showSnapshot();

  //Start face tracking
  if ( this._face_tracking === true ) {
    this.startFaceTracking();
  }
};

ImmediaTracker.prototype.startFaceTracking = function() {
  if ( this.htracker && this._face_tracking === true ) {
    this.htracker.init(this.video, this.trackerCanvas, false /*init video*/);
    this.htracker.start();
  }
};

ImmediaTracker.prototype.stopFaceTracking = function() {
  if ( this.htracker ) {
    this.htracker.stop();
  }
};

ImmediaTracker.prototype.stopVideo = function() {
  // Stop the video
  this._stopVideo();

  // Gray out the last taken snapshot by:
  // - getting the pixels from the canvas
  var imgData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
  var d = imgData.data;
  // - averaging out R G and B for each pixels
  for(var i=0; i<d.length; i+=4) {
    var average = (d[i] + d[i+1] + d[i+2]) / 3;
    d[i] = d[i+1] = d[i+2] = average;
  }
  // Writing the pixel data back out to the canvas
  this.context.putImageData(imgData, 0, 0);
}

ImmediaTracker.prototype._stopVideo = function() {
  //Stop automatic snapshots
  if ( this._snapshotTimeoutHndl ) {
    window.clearTimeout(this._snapshotTimeoutHndl);
  }

  //Stop the tracker so that it doesn't keep trying to find a face
  this.stopFaceTracking();

  //Stop the stream
  var track = this.stream.getTracks()[0];  // if only one media track
  track.stop();
};

ImmediaTracker.prototype.snoozeVideo = function() {
  if ( this._snoozed ) {
     return;
  }
  this._snoozed = true;

  //Stop video!
  this._stopVideo();

  //Draw nice "snooze" icon on top of the last snapshot
  this.context.drawImage(this._snoozeImage,
    (this.canvas.width - this._snoozeImage.width) / 2,
    (this.canvas.height - this._snoozeImage.height) / 2
  );

  //Try to regain control of camera
  var that = this;
  var retry = $.proxy(
    this.startUserMedia,
    this,
    function(error) {
      setTimeout(retry, that.options.snoozeRetryInterval);
    },
    function() {
      //Regained control of the camera
      that._snoozed = false;
      that.showSnapshot();
    }
  );

  setTimeout(retry, this.options.snoozeReleaseTime);
};

ImmediaTracker.prototype.showSnapshot = function() {

  try {
    if ( this._found && this.lastDynamicSnapshot && this._face_tracking ) {
      this.showTrackedSnapshot();
    } else {
      this.showFixedSnapshot();
    }
  } catch ( e ) {
    console.error("Failed to show snapshot: " + e);
  }

  //While we are snoozed, we have to stop the snapshot refresh so we don't loose the nice icon
  if (! this._snoozed ) {
    this._snapshotTimeoutHndl = setTimeout($.proxy(this.showSnapshot, this), this.options.snapshotInterval);
  }
};

ImmediaTracker.prototype.showFixedSnapshot = function() {
  /* Ported from JACs original code */
  this.context.drawImage(this.video, 160, 120, 360, 240, 0, 0, this.canvas.width, this.canvas.height);
};

ImmediaTracker.prototype.showTrackedSnapshot = function() {
  //Shows the last tracked snapshot available
  this.context.putImageData(this.lastDynamicSnapshot,0,0,0,0,this.canvas.width, this.canvas.height);
};

ImmediaTracker.prototype.toggleFaceTracking = function() {
  this._face_tracking = !this._face_tracking;

  //Don't do anything else if we are snoozed
  if ( this._snoozed === true ) {
    return;
  }

  if ( this._face_tracking === true ) {
    this.startFaceTracking();
  } else {
    this.stopFaceTracking();
  }

  //Cancel exising timeout so we don't have multiple calls to showSnapshot()
  if ( this._snapshotTimeoutHndl ) {
    window.clearTimeout(this._snapshotTimeoutHndl);
  }

  //This is just to see an instant update when toggled ( vs wait till next snapshot )
  this.showSnapshot();
};
