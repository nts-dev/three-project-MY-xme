import React from "react";
import { FiShoppingCart } from "react-icons/fi";
import { formatEuro, getSelectedProduct } from "./systemBuilderUtils";

export default function SystemBuilderNativeProductTable({ groups, onProductFocus }) {
    return (
        <section className="sb-native-table" aria-label="System builder products">
            <div className="sb-native-table__head">
                <span>Model</span>
                <span>Name</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Total price</span>
                <span>Stock</span>
                <span>View</span>
            </div>
            {groups.map((group, groupIndex) => {
                const selectedProduct = getSelectedProduct(group);
                const isOpen = groupIndex === 0;
                return (
                    <div className={`sb-native-group ${isOpen ? "is-open" : ""}`} key={group.id}>
                        <button
                            type="button"
                            className="sb-native-row sb-native-row--selected"
                            onMouseEnter={() => onProductFocus(selectedProduct)}
                        >
                            <span><i /> {group.title}</span>
                            <strong>{selectedProduct?.name || `Without ${group.title}`}</strong>
                            <span>{Math.max(1, group.minQty || 1)}</span>
                            <span>{formatEuro(selectedProduct?.price || 0)}</span>
                            <b>{formatEuro(selectedProduct?.price || 0)}</b>
                            <span>{selectedProduct?.stock ?? 0}</span>
                            <FiShoppingCart />
                        </button>
                        {isOpen && group.products.slice(0, 3).map((product) => (
                            <button
                                type="button"
                                className="sb-native-row sb-native-row--option"
                                key={product.id}
                                onMouseEnter={() => onProductFocus(product)}
                            >
                                <span />
                                <span>
                                    <input type="checkbox" checked={product.id === selectedProduct?.id} readOnly />
                                    {product.name}
                                </span>
                                <span>{product.id === selectedProduct?.id ? 1 : "-"}</span>
                                <span>{formatEuro(product.price)}</span>
                                <b>{formatEuro(product.price)}</b>
                                <span>{product.stock ?? 0}</span>
                                <FiShoppingCart />
                            </button>
                        ))}
                    </div>
                );
            })}
        </section>
    );
}
