import React from 'react';
import PropTypes from 'prop-types';

import './styles/closeButton.css';

export const CloseButton = ({ onClickStop, onClickStart, isOpen }) => {
  if (isOpen) {
    return (
      <div id="container-close-button" style={{background:'red'}}
        onClick = {onClickStop}
      >Stop Recording&nbsp;&#9724;
      </div>
    );
  } else {
    return (
      <div id="container-close-button" style={{background:'transparent'}}
        onClick = {onClickStart}
      >Start Recording&nbsp;&#9658;
      </div>
    );
  }
};

CloseButton.propTypes = {
  onClickStart: PropTypes.func.isRequired,
  onClickStop: PropTypes.func.isRequired
};

export default CloseButton;
