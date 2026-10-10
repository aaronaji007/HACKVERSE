import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { GeometryEngine } from '../lib/geometryEngine';
import { GeometryOutput, LineProperties } from '../types';

interface SvgRendererProps {
    geometry: GeometryOutput;
    isTeachingMode: boolean;
    currentSequence: number;
    totalSequences: number;
    totalStages: number;
    onSequenceChange: React.Dispatch<React.SetStateAction<number>>;
    lineProperties?: LineProperties;
}

export const SvgRenderer: React.FC<SvgRendererProps> = ({
    geometry,
    isTeachingMode,
    currentSequence,
    totalSequences,
    totalStages,
    onSequenceChange,
    lineProperties,
}) => {
    const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const isPanning = useRef(false);
    const lastPoint = useRef({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<SVGGElement>(null);

    const primitivesToRender = geometry.constructionPrimitives.filter(
        (primitive) => (primitive.sequence || 0) <= currentSequence,
    );

    const currentSequencePrimitives = geometry.constructionPrimitives.filter(
        (primitive) => (primitive.sequence || 0) === currentSequence,
    );

    const getRenderPriority = (primitive: GeometryOutput['constructionPrimitives'][number]) => {
        if (primitive.primitiveRole === 'dimension' || primitive.primitiveRole === 'projection') return 0;
        if (primitive.primitiveRole === 'hidden') return 1;
        if (primitive.primitiveRole === 'axis' || ('lineStyle' in primitive && primitive.lineStyle === 'chain')) return 2;
        if (primitive.type === 'text') return 4;
        return 3;
    };

    const orderedPrimitivesToRender = [...primitivesToRender].sort((left, right) => {
        const priorityDiff = getRenderPriority(left) - getRenderPriority(right);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }

        return (left.sequence || 0) - (right.sequence || 0);
    });

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!isTeachingMode) {
            setIsPlaying(false);
        }
    }, [isTeachingMode]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
            if (!isTeachingMode || isPlaying) return;
            if (event.key === 'ArrowRight') {
                onSequenceChange(Math.min(currentSequence + 1, totalSequences));
            } else if (event.key === 'ArrowLeft') {
                onSequenceChange(Math.max(currentSequence - 1, 0));
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [currentSequence, isTeachingMode, isPlaying, totalSequences, onSequenceChange]);

    useEffect(() => {
        if (!isTeachingMode || !isPlaying) {
            return;
        }

        if (currentSequence >= totalSequences) {
            setIsPlaying(false);
            return;
        }

        const timer = window.setTimeout(() => {
            onSequenceChange((prevSequence) => prevSequence + 1);
        }, 350);

        return () => window.clearTimeout(timer);
    }, [currentSequence, isPlaying, isTeachingMode, onSequenceChange, totalSequences]);

    useLayoutEffect(() => {
        const fitContentToViewport = () => {
            const contentNode = contentRef.current;
            if (!contentNode || primitivesToRender.length === 0) {
                setView({ x: 0, y: 0, scale: 1 });
                return;
            }

            const bbox = contentNode.getBBox();
            if (!bbox.width || !bbox.height) {
                setView({ x: 0, y: 0, scale: 1 });
                return;
            }

            const padding = 48;
            const availableWidth = GeometryEngine.VIEW_WIDTH - (padding * 2);
            const availableHeight = GeometryEngine.VIEW_HEIGHT - (padding * 2);
            const scale = Math.min(availableWidth / bbox.width, availableHeight / bbox.height);
            const scaledWidth = bbox.width * scale;
            const scaledHeight = bbox.height * scale;

            setView({
                x: padding + ((availableWidth - scaledWidth) / 2) - (bbox.x * scale),
                y: padding + ((availableHeight - scaledHeight) / 2) - (bbox.y * scale),
                scale,
            });
        };

        const frame = window.requestAnimationFrame(fitContentToViewport);
        return () => window.cancelAnimationFrame(frame);
    }, [currentSequence, geometry, isFullscreen, isTeachingMode, primitivesToRender.length]);

    const handleMouseDown = (event: React.MouseEvent) => {
        isPanning.current = true;
        lastPoint.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseMove = (event: React.MouseEvent) => {
        if (!isPanning.current) return;

        const dx = event.clientX - lastPoint.current.x;
        const dy = event.clientY - lastPoint.current.y;

        setView((currentView) => ({
            ...currentView,
            x: currentView.x + dx,
            y: currentView.y + dy,
        }));

        lastPoint.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
        isPanning.current = false;
    };

    const handleWheel = (event: React.WheelEvent) => {
        event.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const { left, top } = svg.getBoundingClientRect();
        const mouseX = event.clientX - left;
        const mouseY = event.clientY - top;
        const zoomFactor = 1.1;
        const newScale = event.deltaY < 0 ? view.scale * zoomFactor : view.scale / zoomFactor;
        const worldX = (mouseX - view.x) / view.scale;
        const worldY = (mouseY - view.y) / view.scale;

        setView({
            x: mouseX - worldX * newScale,
            y: mouseY - worldY * newScale,
            scale: newScale,
        });
    };

    const zoomAtCenter = (zoomIn: boolean) => {
        const svg = svgRef.current;
        if (!svg) return;

        const bounds = svg.getBoundingClientRect();
        const mouseX = bounds.width / 2;
        const mouseY = bounds.height / 2;
        const zoomFactor = 1.25;
        const newScale = zoomIn ? view.scale * zoomFactor : view.scale / zoomFactor;
        const worldX = (mouseX - view.x) / view.scale;
        const worldY = (mouseY - view.y) / view.scale;

        setView({
            x: mouseX - worldX * newScale,
            y: mouseY - worldY * newScale,
            scale: newScale,
        });
    };

    const handleResetView = () => {
        const contentNode = contentRef.current;
        if (!contentNode) {
            setView({ x: 0, y: 0, scale: 1 });
            return;
        }

        const bbox = contentNode.getBBox();
        if (!bbox.width || !bbox.height) {
            setView({ x: 0, y: 0, scale: 1 });
            return;
        }

        const padding = 48;
        const availableWidth = GeometryEngine.VIEW_WIDTH - (padding * 2);
        const availableHeight = GeometryEngine.VIEW_HEIGHT - (padding * 2);
        const scale = Math.min(availableWidth / bbox.width, availableHeight / bbox.height);
        const scaledWidth = bbox.width * scale;
        const scaledHeight = bbox.height * scale;

        setView({
            x: padding + ((availableWidth - scaledWidth) / 2) - (bbox.x * scale),
            y: padding + ((availableHeight - scaledHeight) / 2) - (bbox.y * scale),
            scale,
        });
    };

    const handleFullscreen = () => {
        if (!containerRef.current) return;

        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void containerRef.current.requestFullscreen();
        }
    };

    const handlePlayPause = () => {
        if (currentSequence >= totalSequences) {
            onSequenceChange(0);
        }

        setIsPlaying((current) => !current);
    };

    const handleNext = () => {
        setIsPlaying(false);
        onSequenceChange(Math.min(currentSequence + 1, totalSequences));
    };

    const handlePrev = () => {
        setIsPlaying(false);
        onSequenceChange(Math.max(currentSequence - 1, 0));
    };

    const animationStyles = isTeachingMode ? (
        <style>
            {currentSequencePrimitives.map((primitive) => {
                if (primitive.type === 'text') {
                    return `
                        @keyframes fade-${primitive.key} {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                    `;
                }

                return `
                    @keyframes draw-${primitive.key} {
                        from { stroke-dashoffset: 1; }
                        to { stroke-dashoffset: 0; }
                    }
                `;
            }).join('\n')}
        </style>
    ) : null;

    const linePropertyRows = lineProperties ? [
        { label: 'True Length (TL)', value: `${lineProperties.trueLength.toFixed(2)} mm` },
        { label: 'Plan Length (PL)', value: `${lineProperties.planLength.toFixed(2)} mm` },
        { label: 'Elevation Length (EL)', value: `${lineProperties.elevationLength.toFixed(2)} mm` },
        { label: 'Inclination with HP', value: `${lineProperties.trueInclinationHP.toFixed(2)}\u00B0` },
        { label: 'Inclination with VP', value: `${lineProperties.trueInclinationVP.toFixed(2)}\u00B0` },
        { label: 'Apparent Inclination (FV)', value: `${lineProperties.apparentInclinationHP.toFixed(2)}\u00B0` },
        { label: 'Apparent Inclination (TV)', value: `${lineProperties.apparentInclinationVP.toFixed(2)}\u00B0` },
    ] : [];

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                backgroundColor: '#ffffff',
                border: isFullscreen ? '0' : '2px solid var(--color-border)',
                width: '100%',
                height: isFullscreen ? '100vh' : '100%',
                minHeight: isFullscreen ? '0' : '320px',
                flex: isFullscreen ? undefined : '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {animationStyles}

            <div style={styles.topControls}>
                <button onClick={() => zoomAtCenter(true)} style={styles.controlButton} aria-label="Zoom In" title="Zoom In">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                        <line x1="16.65" y1="16.65" x2="21" y2="21" />
                    </svg>
                </button>
                <button onClick={() => zoomAtCenter(false)} style={styles.controlButton} aria-label="Zoom Out" title="Zoom Out">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                        <line x1="16.65" y1="16.65" x2="21" y2="21" />
                    </svg>
                </button>
                <button onClick={handleResetView} style={styles.controlButton} aria-label="Fit View" title="Fit View">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                    </svg>
                </button>
                <button onClick={handleFullscreen} style={styles.controlButton} aria-label="Toggle Fullscreen" title="Toggle Fullscreen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                </button>
            </div>

                    {isTeachingMode && totalSequences > 0 && (
                <div style={styles.transportControls}>
                    <button onClick={handlePrev} disabled={currentSequence === 0} style={styles.transportSecondary} aria-label="Previous Step">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 19 2 12 11 5 11 19" />
                            <polygon points="22 19 13 12 22 5 22 19" />
                        </svg>
                    </button>
                    <button onClick={handlePlayPause} style={styles.transportPrimary} aria-label={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                        )}
                    </button>
                    <button onClick={handleNext} disabled={currentSequence === totalSequences} style={styles.transportSecondary} aria-label="Next Step">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 19 22 12 13 5 13 19" />
                            <polygon points="2 19 11 12 2 5 2 19" />
                        </svg>
                    </button>
                </div>
            )}

            {linePropertyRows.length > 0 && (
                <div style={styles.lineProperties}>
                    {linePropertyRows.map((row) => (
                        <div key={row.label} style={styles.linePropertyRow}>
                            <span style={styles.linePropertyLabel}>{row.label}</span>
                            <span style={styles.linePropertyValue}>{row.value}</span>
                        </div>
                    ))}
                </div>
            )}

            <svg
                ref={svgRef}
                viewBox={`0 0 ${GeometryEngine.VIEW_WIDTH} ${GeometryEngine.VIEW_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                    backgroundColor: '#ffffff',
                    cursor: isPanning.current ? 'grabbing' : 'grab',
                    width: '100%',
                    height: '100%',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <defs>
                    <pattern id="hatch" width="9" height="9" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="9" stroke="#2f2f2f" strokeWidth="0.9" />
                    </pattern>
                    <marker id="dimensionArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="strokeWidth">
                        <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="#5f6368" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </marker>
                </defs>
                <rect width="100%" height="100%" fill="#ffffff" />

                <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                    <g ref={contentRef}>
                        {orderedPrimitivesToRender.map((primitive) => {
                            const isCurrentPrimitive = isTeachingMode && (primitive.sequence || 0) === currentSequence;
                            const defaultColor = primitive.color || '#10224d';
                            const highlightColor = '#0b57ff';
                            const strokeColor = isCurrentPrimitive ? highlightColor : defaultColor;
                            const indexInStep = currentSequencePrimitives.indexOf(primitive);
                            const delay = indexInStep * 200;

                            const animationStyle: React.CSSProperties = isCurrentPrimitive ? {
                                animationName: primitive.type === 'text' ? `fade-${primitive.key}` : `draw-${primitive.key}`,
                                animationDuration: primitive.type === 'line' ? '500ms' : primitive.type === 'circle' ? '600ms' : primitive.type === 'path' ? '700ms' : '300ms',
                                animationDelay: `${delay}ms`,
                                animationFillMode: 'both',
                                animationTimingFunction: primitive.type === 'text' ? 'ease-in' : 'ease-in-out',
                            } : {};

                            const getDashArray = (prim: any, animating: boolean) => {
                                if (animating) return '1';
                                if (prim.lineStyle === 'dotted') return '1.5 3';
                                if (prim.lineStyle === 'chain') return '8 3 2 3';
                                if (prim.lineStyle === 'dashed' || prim.dashed) return '6 3';
                                return 'none';
                            };

                            const getStrokeWidth = (prim: any) => {
                                let w = 2.6;
                                if (prim.primitiveRole === 'construction') {
                                    w = 1.0;
                                } else if (prim.primitiveRole === 'dimension' || prim.primitiveRole === 'projection' || prim.primitiveRole === 'axis') {
                                    w = 1.25;
                                } else if (prim.primitiveRole === 'hidden') {
                                    w = 1.25;
                                } else if (prim.primitiveRole === 'plane') {
                                    w = 1.8;
                                } else if (prim.lineStyle === 'dashed' || prim.lineStyle === 'dotted' || prim.dashed) {
                                    w = 1.25;
                                }
                                return w / view.scale;
                            };

                            const getAnimatingStrokeWidth = (prim: any) => {
                                return (prim.lineStyle || prim.dashed ? 1.5 : 3) / view.scale;
                            };

                            const strokeWidth = isCurrentPrimitive ? getAnimatingStrokeWidth(primitive) : getStrokeWidth(primitive);
                            const dashArray = getDashArray(primitive, isCurrentPrimitive);

                            if (primitive.type === 'line') {
                                const isDimensionLine = primitive.primitiveRole === 'dimension' && primitive.key.endsWith('-dim');
                                return (
                                    <line
                                        key={primitive.key}
                                        x1={primitive.points[0]}
                                        y1={primitive.points[1]}
                                        x2={primitive.points[2]}
                                        y2={primitive.points[3]}
                                        stroke={strokeColor}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={dashArray}
                                        markerStart={isDimensionLine ? 'url(#dimensionArrow)' : undefined}
                                        markerEnd={isDimensionLine ? 'url(#dimensionArrow)' : undefined}
                                        pathLength={isCurrentPrimitive ? 1 : undefined}
                                        style={animationStyle}
                                    />
                                );
                            }

                            if (primitive.type === 'text') {
                                const strokeW = 4 / view.scale;
                                const fontSize = (primitive.fontSize || (primitive.primitiveRole === 'caption' ? 14 : primitive.primitiveRole === 'dimension' ? 12 : 13)) / view.scale;
                                const color = isCurrentPrimitive ? highlightColor : (primitive.color || '#08101f');
                                const fontWeight = isCurrentPrimitive ? 'bold' : (primitive.fontWeight || (primitive.primitiveRole === 'caption' ? 'bold' : 'normal'));
                                const dominantBaseline = primitive.dominantBaseline || 'middle';
                                const textAnchor = primitive.textAnchor || 'start';
                                const rotation = primitive.rotation || 0;
                                const textProps = {
                                    x: primitive.x,
                                    y: primitive.y,
                                    fontSize,
                                    fontWeight,
                                    dominantBaseline,
                                    textAnchor,
                                    transform: `rotate(${rotation} ${primitive.x} ${primitive.y})`,
                                };
                                return (
                                    <React.Fragment key={primitive.key}>
                                        <text
                                            {...textProps}
                                            fill="white"
                                            stroke="white"
                                            strokeWidth={strokeW}
                                            strokeLinejoin="round"
                                            style={{ paintOrder: 'stroke fill' } as React.CSSProperties}
                                        >
                                            {primitive.content}
                                        </text>
                                        <text
                                            {...textProps}
                                            fill={color}
                                            style={animationStyle as React.CSSProperties}
                                        >
                                            {primitive.content}
                                        </text>
                                    </React.Fragment>
                                );
                            }

                            if (primitive.type === 'circle') {
                                return (
                                    <circle
                                        key={primitive.key}
                                        cx={primitive.cx}
                                        cy={primitive.cy}
                                        r={primitive.r}
                                        stroke={strokeColor}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={dashArray}
                                        pathLength={isCurrentPrimitive ? 1 : undefined}
                                        fill="none"
                                        style={animationStyle}
                                    />
                                );
                            }

                            if (primitive.type === 'path') {
                                return (
                                    <path
                                        key={primitive.key}
                                        d={primitive.d}
                                        stroke={strokeColor}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={dashArray}
                                        pathLength={isCurrentPrimitive ? 1 : undefined}
                                        fill={primitive.fill || 'none'}
                                        style={animationStyle}
                                    />
                                );
                            }

                            return null;
                        })}
                    </g>
                </g>
            </svg>
        </div>
    );
};

const overlayButtonBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--color-primary)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    color: '#000000',
    cursor: 'pointer',
};

const styles: { [key: string]: React.CSSProperties } = {
    topControls: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 10,
        display: 'flex',
        gap: '8px',
    },
    controlButton: {
        ...overlayButtonBase,
        width: '34px',
        height: '34px',
    },
    transportControls: {
        position: 'absolute',
        left: '10px',
        bottom: '10px',
        zIndex: 10,
        display: 'flex',
        gap: '8px',
    },
    transportSecondary: {
        ...overlayButtonBase,
        width: '40px',
        height: '40px',
    },
    transportPrimary: {
        ...overlayButtonBase,
        width: '46px',
        height: '40px',
        backgroundColor: 'var(--color-primary)',
        color: '#ffffff',
    },
    lineProperties: {
        position: 'absolute',
        right: '14px',
        bottom: '14px',
        zIndex: 10,
        width: 'min(360px, calc(100% - 28px))',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        pointerEvents: 'none',
        fontSize: '12px',
        lineHeight: 1.35,
    },
    linePropertyRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '12px',
    },
    linePropertyLabel: {
        color: '#050816',
        textAlign: 'left',
    },
    linePropertyValue: {
        color: '#0b57ff',
        textAlign: 'right',
    },
};
