import React from "react";
import TreasureInstance from "./TreasureInstance";

export default function TreasureToken({ object, name, createInstances }) {
  return (
    <group name={`${name}_treasures`}>
      {createInstances.map((inst, i) => (
        <TreasureInstance
          key={`${name}_${i}`}
          index={i}
          inst={inst}
          object={object}
        />
      ))}
    </group>
  );
}
