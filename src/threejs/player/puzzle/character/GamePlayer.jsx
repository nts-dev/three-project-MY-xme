import Ecctrl from "./Ecctrl";
import CharacterModel from "./CharacterModel";
import Floor from "../../../Floor.jsx";

export default function GamePlayer() {

    return (
        <>

        <Ecctrl
        position={[0, 0.5, 0]}
        // scale={[0.1, 0.1, 0.1]}
        animated
        followLight
        springK={0.01}
        dampingC={0.2}
        autoBalanceSpringK={1.2}
        autoBalanceDampingC={0.04}
        autoBalanceSpringOnY={0.7}
        autoBalanceDampingOnY={0.05}
        >
            {/* Replace your model here */}
            <CharacterModel />
        </Ecctrl>
            {/*<Floor />*/}
        </>
    );
}