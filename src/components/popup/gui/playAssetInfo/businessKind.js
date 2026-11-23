import {
    FaBuilding,
    FaCar,
    FaFlask,
    FaHardHat,
    FaHospital,
    FaIndustry,
    FaLaptop,
    FaPaintRoller,
    FaPaw,
    FaSchool,
    FaStore,
    FaTruck,
    FaUtensils,
} from "react-icons/fa";

// Industry of a business, for the icon and name shown on its info cards. Uses the Business Type
// field when filled; otherwise it is read from the name, description and comments. The first
// match wins, so the more specific kinds come first (a "food manufacturer" is Food, not Manufacturing).
const KINDS = [
    { test: /\bpets?\b|pet products|veterinar/, label: "Pet Supplies", Icon: FaPaw, className: "pet", color: "#f59e0b" },
    { test: /restaurant|\bfood\b|cafe|coffee|dining|kitchen|catering|bistro|bakery|snack|confection|beverage/, label: "Food & Beverage", Icon: FaUtensils, className: "restaurant", color: "#f97316" },
    { test: /school|education|academy|college|university|tuition|training|tvet/, label: "Education", Icon: FaSchool, className: "school", color: "#6366f1" },
    { test: /\bcars?\b|truck|automobile|automotive|motor vehicle|vehicle|garage|workshop|tyre/, label: "Automotive", Icon: FaCar, className: "automotive", color: "#0ea5e9" },
    { test: /computer|laptop|server|software|workstation|electronics|\bict\b/, label: "IT & Computers", Icon: FaLaptop, className: "it", color: "#3b82f6" },
    { test: /interior|renovation|decor|furnish|design and build/, label: "Interior Design", Icon: FaPaintRoller, className: "interior", color: "#a855f7" },
    { test: /laborator|cosmetic|pharma|chemical/, label: "Laboratory & Cosmetics", Icon: FaFlask, className: "lab", color: "#14b8a6" },
    { test: /construction|hardware|building material|plumbing|contractor/, label: "Construction", Icon: FaHardHat, className: "construction", color: "#eab308" },
    { test: /clinic|hospital|medical|health|dental/, label: "Healthcare", Icon: FaHospital, className: "healthcare", color: "#ef4444" },
    { test: /logistic|freight|courier|transport|haulage|warehouse/, label: "Logistics", Icon: FaTruck, className: "logistics", color: "#64748b" },
    { test: /store|shop|retail|market|mall|mart|trading|trader|wholesale/, label: "Retail & Trading", Icon: FaStore, className: "store", color: "#ec4899" },
    { test: /manufactur|factory|industr|fabricat|welding/, label: "Manufacturing", Icon: FaIndustry, className: "manufacturing", color: "#78716c" },
];

const usable = (value) => {
    const text = String(value ?? "").trim();
    return text && !/^n\/?a$/i.test(text) ? text : "";
};

// texts: the name first, then descriptions. The type and name are tried on their own before the
// descriptions, which often mention other trades.
export const getBusinessKind = (businessType, ...texts) => {
    const type = usable(businessType);
    const parts = [type, ...texts.map(usable)].map((text) => text.toLowerCase());
    const match = (text) => KINDS.find((item) => item.test.test(text));
    const kind = match(parts.slice(0, 2).join(" ")) || match(parts.join(" "));
    return kind
        ? { label: type || kind.label, Icon: kind.Icon, className: kind.className, color: kind.color }
        : { label: type || "Company", Icon: FaBuilding, className: "company", color: "#10b981" };
};

// "No. 123, Jalan Platinum 5/5" from the building/street number and street name.
export const formatStreetAddress = (number, streetName) => {
    const no = usable(number);
    const street = usable(streetName);
    const numberText = no ? (/^(no\.?|lot|unit)\s/i.test(no) ? no : `No. ${no}`) : "";
    return [numberText, street].filter(Boolean).join(", ");
};
