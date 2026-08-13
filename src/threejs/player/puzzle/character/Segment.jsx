import {memo, useMemo} from "react";
import useGame from "../../../../hooks/useGame";
import {CuboidCollider, RigidBody} from "@react-three/rapier";


export default memo(function Segment({

                                         color = "#ff4d9d",
                                     }) {
    const ladderPositions = useGame((state) => state.ladderPositions);

    const data = useMemo(() =>{
        console.log(ladderPositions)
        return ladderPositions
    } , [ladderPositions]);


    return (
        <>
            {data.map((item, i) => {
                const [x, y, z] = item.position;
                const [w, h, d] = item.args;

                const handleIntersectionEnter = (h) => {
                    // console.log("Intersection Enter");
                    // nearLadder.current = true;
                    // ladderHeight.current = h;
                };
                const handleIntersectionExit = () => {
                    // console.log("Intersection Exit");
                    // nearLadder.current = false;
                };


                return (
                    <RigidBody
                        key={i}
                        name={`ladder_${i}`}
                        userData={{ name: `ladder_${i}`, source: "Segment" }}
                        type="fixed" // ✅ ladder is static
                        colliders={false} // we'll add our own collider below

                    >
                        {/* ✅ Visual Mesh */}
                        <mesh position={[x, y, z]}>
                            <boxGeometry args={[w, h, d]} />
                            <meshStandardMaterial color={color} />
                        </mesh>

                        {/* ✅ Matching Collider (half-extents) */}
                        <CuboidCollider
                            args={[w / 2, h / 2, d / 2]}
                            position={[x, y, z]}
                            sensor
                            userData={{ name: `ladder_${i}`, source: "Segment" }}
                            onIntersectionEnter={()=>handleIntersectionEnter(h)}
                            onIntersectionExit={()=>handleIntersectionExit()}
                        />
                    </RigidBody>
                );
            })}
        </>
    );

});
