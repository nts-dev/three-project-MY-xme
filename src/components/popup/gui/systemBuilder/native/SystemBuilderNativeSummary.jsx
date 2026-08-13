import React from "react";
import { FiFileText, FiMinus, FiPlus, FiShoppingCart, FiTrash } from "react-icons/fi";
import { formatEuro } from "./systemBuilderUtils";

export default function SystemBuilderNativeSummary({ detail, quantity, total }) {
    const vat = total * 0.21;
    const totalWithVat = total + vat;

    return (
        <section className="sb-native-summary">
            <div className="sb-native-summary__head">
                <span>System</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Total</span>
                <span>VAT</span>
                <span>Total price inc VAT</span>
            </div>
            <div className="sb-native-summary__main">
                <strong>{detail?.title || "HP Z820"}</strong>
                <span>{quantity}</span>
                <span>{formatEuro(total)}</span>
                <span>{formatEuro(total)}</span>
                <span>{formatEuro(vat)}</span>
                <strong>{formatEuro(totalWithVat)}</strong>
            </div>
            <div className="sb-native-summary__actions">
                <div className="sb-native-qty">
                    <FiMinus />
                    <b>{quantity}</b>
                    <FiPlus />
                </div>
                <button type="button" aria-label="Delete"><FiTrash /></button>
                <button type="button" aria-label="PDF"><FiFileText /></button>
                <button type="button" aria-label="Cart"><FiShoppingCart /></button>
                <p>Shipping costs will be calculated in shopping basket. Assembly and installation costs are included.</p>
            </div>
        </section>
    );
}
