
// const foodTypes = {
//   WILD_FOOD: "wild food",
//   FARM_FOOD: "farm food",
//   HUNTING_FOOD: "venison"
// };
//
// const usableTypes = {
//   POTION: "potion"
// };
// export const Types = {
//   TREASURE: "treasure",
//   BOOSTER: "booster",
//   HANDS: "hands",
//   WEAPON: "weapon",
//   MAIN_HAND: "main-hand",
//   OFF_HAND: "off-hand",
//   BLUE_KEY: "blue_key",
//   RED_KEY: "red_key",
//   YELLOW_KEY: "yellow_key",
//   GREEN_KEY: "green_key",
//   INVISIBLE: "invisible",
//   AMULET: "amulet",
//   PANTS: "pants",
//   FEET: "feet",
//
//   ...foodTypes,
//   ...usableTypes
// };

export const bagConfig = {
  bagBoxes: [...Array(5).keys()]
};

export const itemDictionary = {
  0: {
    id: 0,
    name: "Powered Booster",
    attributes: {
      attack: 1
    },
    image: `${import.meta.env.VITE_ASSET_URL}/assets/treasure/${'Booster.png'}`,
    stackable: true,
    type: 'booster',
    count:3
  }

};
