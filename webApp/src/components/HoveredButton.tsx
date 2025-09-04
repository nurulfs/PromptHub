import React, { useState } from "react";

// Reusable hoverable button
export default function HoverButton(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        baseStyle: React.CSSProperties;
        hoverStyle?: React.CSSProperties;
    }
) {
    const { baseStyle, hoverStyle, style, ...rest } = props;
    const [hover, setHover] = useState(false);

    return (
        <button
            {...rest}
            style={{
                ...baseStyle,
                transition: "all 0.2s ease",
                cursor: "pointer",
                ...(hover ? hoverStyle : {}),
                ...(style || {}),
            }}
            onMouseEnter={(e) => {
                setHover(true);
                props.onMouseEnter?.(e);
            }}
            onMouseLeave={(e) => {
                setHover(false);
                props.onMouseLeave?.(e);
            }}
        />
    );
}

