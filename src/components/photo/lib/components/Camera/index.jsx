import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { FACING_MODES, IMAGE_TYPES } from 'jslib-html5-camera-photo';
import { useLibCameraPhoto } from './hooks/useLibCameraPhoto';
import CircleButton from '../CircleButton/index.jsx';
import WhiteFlash from '../WhiteFlash/index.jsx';
import DisplayError from '../DisplayError/index.jsx';
import {
  getShowHideStyle,
  getVideoStyles,
  playClickAudio,
  printCameraInfo
} from './helpers.jsx';
import './styles/camera.css';
import StopStartButton from "../StopStartButton/index.jsx";

let showVideoTimeoutId = null;

function Camera(props) {
  const [dataUri, setDataUri] = useState('');
  const [isShowVideo, setIsShowVideo] = useState(true);
  const [cameraStartDisplayError, setCameraStartDisplayError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);

  let videoRef = useRef(null);

  const [
    mediaStream,
    cameraStartError,
    cameraStopError,
    getDataUri
  ] = useLibCameraPhoto(videoRef, props.idealFacingMode, props.idealResolution, props.isMaxResolution);

  useEffect(() => {
    if (mediaStream) {
      if (typeof props.onCameraStart === 'function') {
        props.onCameraStart(mediaStream);
      }
    } else {
      if (typeof props.onCameraStop === 'function') {
        props.onCameraStop();
      }
    }
  }, [mediaStream]);

  useEffect(() => {
    if (cameraStartError) {
      setCameraStartDisplayError(`${cameraStartError.name} ${cameraStartError.message}`);
      if (typeof props.onCameraError === 'function') {
        props.onCameraError(cameraStartError);
      }
    }
  }, [cameraStartError]);

  useEffect(() => {
    if (cameraStopError) {
      printCameraInfo(cameraStopError.message);
    }
  }, [cameraStopError]);

  function clearShowVideoTimeout() {
    if (showVideoTimeoutId) {
      clearTimeout(showVideoTimeoutId);
    }
  }

  function getIsImageMirror() {
    if (props.isImageMirror !== undefined) {
      return props.isImageMirror;
    }

    if (props.idealFacingMode === FACING_MODES.USER) {
      return true;
    }

    return false;
  }

  function handleTakePhoto() {
    const configDataUri = {
      sizeFactor: props.sizeFactor,
      imageType: props.imageType,
      imageCompression: props.imageCompression,
      isImageMirror: getIsImageMirror()
    };

    let dataUri = getDataUri(configDataUri);

    if (!props.isSilentMode) {
      playClickAudio();
    }

    if (typeof props.onTakePhoto === 'function') {
      props.onTakePhoto(dataUri);
    }

    setDataUri(dataUri);
    setIsShowVideo(false);

    clearShowVideoTimeout();
    showVideoTimeoutId = setTimeout(() => {
      setIsShowVideo(true);

      if (typeof props.onTakePhotoAnimationDone === 'function') {
        props.onTakePhotoAnimationDone(dataUri);
      }
    }, 900);
  }

  function handleStartRecording() {
    if (mediaStream) {
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setDataUri(url);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Pass the mediaStream to the parent via the onStartRecording callback
      if (typeof props.onStartRecording === 'function') {
        props.onStartRecording(mediaStream);
      }
    }
  }

  function handleStopRecording() {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);

      // Notify the parent that recording has stopped
      if (typeof props.onStopRecording === 'function') {
        props.onStopRecording();
      }
    }
  }

  let videoStyles = getVideoStyles(isShowVideo, getIsImageMirror());
  let showHideImgStyle = getShowHideStyle(!isShowVideo);

  let classNameFullscreen = props.isFullscreen ? 'react-html5-camera-photo-fullscreen' : '';

  return (
      <div className={'react-html5-camera-photo ' + classNameFullscreen}>
        <DisplayError
            cssClass={'display-error'}
            isDisplayError={props.isDisplayStartCameraError}
            errorMsg={cameraStartDisplayError}
        />
        <WhiteFlash isShowWhiteFlash={!isShowVideo} />
        <img style={showHideImgStyle} alt="camera" src={dataUri} />
        <video
            style={videoStyles}
            ref={videoRef}
            autoPlay={true}
            muted={true}
            playsInline
        />
        <CircleButton isClicked={!isShowVideo} onClick={handleTakePhoto} />
        <StopStartButton
            isOpen={isRecording}
            onClickStart={handleStartRecording}
            onClickStop={handleStopRecording}
        />
      </div>
  );
}

Camera.propTypes = {
  onTakePhoto: PropTypes.func,
  onTakePhotoAnimationDone: PropTypes.func,
  onCameraError: PropTypes.func,
  onCameraStart: PropTypes.func,
  onCameraStop: PropTypes.func,
  onStartRecording: PropTypes.func,
  onStopRecording: PropTypes.func,
  idealFacingMode: PropTypes.string,
  idealResolution: PropTypes.object,
  imageType: PropTypes.string,
  isImageMirror: PropTypes.bool,
  isSilentMode: PropTypes.bool,
  isDisplayStartCameraError: PropTypes.bool,
  imageCompression: PropTypes.number,
  isMaxResolution: PropTypes.bool,
  isFullscreen: PropTypes.bool,
  sizeFactor: PropTypes.number
};

Camera.defaultProps = {
  isDisplayStartCameraError: true,
  onStartRecording: () => {},
  onStopRecording: () => {}
};

export {
  Camera,
  FACING_MODES,
  IMAGE_TYPES
};

export default Camera;
