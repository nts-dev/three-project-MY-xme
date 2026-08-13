import styled, { css } from "styled-components";
import frame from "../assets/frame/divider-bottom.png";

const StyledBagItem = styled.div`
  ${({ $isDragging }) => css`
    width: 45px;
    height: 45px;
    border: 0 !important;
    opacity: ${$isDragging ? 0 : 1};
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform, opacity, filter;

    .react-tooltip {
      padding: 0;

      ul {
        list-style-type: none;
      }

      &:after {
        background: url("${frame}") no-repeat;
        content: "";
        position: absolute;
        top: 0;
        left: 0;
      }
    }

    img {
      max-width: 56%;
      max-height: 56%;
      position: relative;
      z-index: 1;
      filter: drop-shadow(0 0 8px rgba(39, 236, 239, 0.35));
      transform: translateY(3px);
    }

    .item-count {
      position: absolute;
      right: 3px;
      bottom: 2px;
      left: auto;
      font-size: 10px;
      width: 100%;
      color: #eaffff;
      padding: 0 2px;
      text-shadow: 1px 1px 0px black;
      text-align: right;
      font-weight: bold;
      z-index: 2;
    }
  `}
`;

StyledBagItem.displayName = "StyledBagItem";

export default StyledBagItem;
