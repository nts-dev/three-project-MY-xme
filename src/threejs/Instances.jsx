import React from "react";
import MovingBlock from "./MovingBlock";

export default function Instances({ object, name, createInstances }) {
  return (
    <group name={`${name}_pushLiftBlocks`}>
      {createInstances.map((inst, i) => (
        <MovingBlock
          key={`${name}_${i}`}
          index={i}
          inst={inst}
          object={object}
        />
      ))}
    </group>
  );
}
