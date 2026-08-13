import styled, { css } from "styled-components";
import { publicAssetCssUrl } from "../publicAssetUrl";

const inventoryItemBgUrl = publicAssetCssUrl("inventory item.svg");

const StyledBagBox = styled.div`
  ${props => {
    const { canDrop, isOver } = props;

    return css`
      position: relative;
      border: ${canDrop
        ? `1px solid ${isOver ? "#27ecef" : "#ffd35a"}`
        : "1px solid transparent"};
      position: relative;

      width: 49.39px;
      display: flex;
      height: 49.39px;
      align-items: center;
      justify-content: center;
      background: ${inventoryItemBgUrl} center / 100% 100% no-repeat !important;
      background-color: transparent !important;
      border-radius: 0;
      box-shadow: none;
      overflow: hidden;
      transition: border-color 180ms ease, box-shadow 180ms ease;
      &::before {
        content: "";
        position: absolute;
        inset: 3.36px;
        pointer-events: none;
        background: transparent;
        z-index: 0;
      }
      &:hover {
        border-color: #7dffff;
        box-shadow: 0 0 8px rgba(39, 236, 239, 0.26);
      }
      .slot-label,
      .slot-count {
        position: absolute;
        left: 5.6px;
        z-index: 2;
        font-family: Inter, "Roboto Mono", monospace;
        font-weight: 400;
        letter-spacing: 0;
        pointer-events: none;
      }
      .slot-label {
        top: 4.9px;
        color: #30d6d6;
        font-size: 5.15px;
        line-height: 6px;
      }
      .slot-count {
        bottom: 4.9px;
        color: #96bd0d;
        font-size: 3.6px;
        line-height: 4px;
      }
      .slot-type {
        color: gold;
        font-size: 8px;
        font-weight: bold;
      }
    `;
  }}
`;

StyledBagBox.displayName = "StyledBagBox";

export default StyledBagBox;
