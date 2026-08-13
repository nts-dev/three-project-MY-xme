import styled from "styled-components";

const StyledInventory = styled.div`
  width: min(284px, calc(100vw - 22px));
  position: relative;
  z-index: 1;

  .boxes-grid {
    display: flex;
    gap: 5.15px;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    min-height: 60.19px;
    padding: 5.66px 3.6px 5.15px;
    background: transparent;
  }

  .motion-inventory-frame {
    transform-origin: center;
    width: 100%;
  
  }

  .motion-inventory-frame .game-hud-frame__content {
    display: block;
  }

  .inventory-slot-motion {
    border-radius: 0;
    flex: 0 0 49.39px;
  }

  .inventory-slot-motion:hover {
    filter: drop-shadow(0 0 10px rgba(39, 236, 239, 0.42));
  }
`;

StyledInventory.displayName = "StyledInventory";

export default StyledInventory;
