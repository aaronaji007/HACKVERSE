import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GeometryOutput } from '../types';
import { resolveScene3D, Scene3DData, Point3D } from '../lib/scene3D';

interface ThreeDViewModalProps {
    geometry: GeometryOutput;
    onClose: () => void;
}

export const ThreeDViewModal: React.FC<ThreeDViewModalProps> = ({ geometry, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const setViewAngleRef = useRef<((view: 'front' | 'top' | 'isometric' | 'side') => void) | null>(null);

    const [sceneData, setSceneData] = useState<Scene3DData | null>(null);
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    useEffect(() => {
        const data = resolveScene3D(geometry);
        setSceneData(data);
        setCurrentStep(data.maxStep); // Default to full model
    }, [geometry]);

    // Step-by-step animation auto-play timer
    useEffect(() => {
        if (!isPlaying || !sceneData) return;

        const interval = setInterval(() => {
            setCurrentStep((prev) => {
                if (prev >= sceneData.maxStep) {
                    setIsPlaying(false);
                    return sceneData.maxStep;
                }
                return prev + 1;
            });
        }, 2200);

        return () => clearInterval(interval);
    }, [isPlaying, sceneData]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !sceneData) return;

        const { mode, points, segments, polygons, dimensions, angleAnnotations, planeSize } = sceneData;

        // 1. Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#fafafa');

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // 2. Camera setup
        const camera = new THREE.PerspectiveCamera(45, width / Math.max(height, 1), 1, 4000);
        const d = planeSize * 1.35;
        if (mode === 'perspective') {
            camera.position.set(d * 0.95, d * 0.85, d * 1.25);
            camera.lookAt(0, planeSize * 0.25, 0);
        } else {
            camera.position.set(d * 0.9, d * 0.8, d * 1.15);
            camera.lookAt(0, planeSize * 0.25, 0);
        }
        cameraRef.current = camera;

        // 3. WebGL Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // 4. CSS2D Label Renderer
        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(width, height);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0';
        labelRenderer.domElement.style.left = '0';
        labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(labelRenderer.domElement);

        // 5. Orbit Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, planeSize * 0.2, mode === 'perspective' ? 0 : planeSize * 0.2);
        controlsRef.current = controls;

        // 6. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        scene.add(ambientLight);
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight1.position.set(planeSize * 1.5, planeSize * 2, planeSize * 1.5);
        scene.add(dirLight1);
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight2.position.set(-planeSize * 1.5, -planeSize, -planeSize * 1.5);
        scene.add(dirLight2);

        // Helper for CSS2D Text Labels
        const createLabel = (text: string, className = 'plane-label') => {
            const div = document.createElement('div');
            div.className = `three-label ${className}`;
            div.textContent = text;
            div.style.color = className.includes('plane') ? '#0b57ff' : className.includes('dimension') ? '#4338ca' : className.includes('station') ? '#c62828' : '#0f172a';
            div.style.fontFamily = 'Geist Mono, monospace';
            div.style.fontSize = className.includes('plane') ? '13px' : '11px';
            div.style.fontWeight = 'bold';
            div.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            div.style.padding = '2px 5px';
            div.style.borderRadius = '3px';
            div.style.border = '1px solid rgba(15, 23, 42, 0.18)';
            div.style.whiteSpace = 'nowrap';
            return new CSS2DObject(div);
        };

        // 7. Reference Planes Setup
        const halfSize = planeSize;

        if (mode === 'perspective') {
            // Ground Plane (GP) extending in front and behind PP: y = 0, z from -halfSize/2 to +halfSize/2
            const gpGeo = new THREE.PlaneGeometry(halfSize * 1.2, halfSize * 1.4);
            const gpMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.88,
                depthWrite: false,
            });
            const gpMesh = new THREE.Mesh(gpGeo, gpMat);
            gpMesh.rotation.x = -Math.PI / 2;
            gpMesh.position.set(0, 0, 0);
            scene.add(gpMesh);

            const gpGrid = new THREE.GridHelper(halfSize * 1.2, 14, 0x93c5fd, 0xe2e8f0);
            gpGrid.position.set(0, 0.05, 0);
            scene.add(gpGrid);

            const gpBadge = createLabel('Ground Plane (G.P.)', 'plane-label');
            gpBadge.position.set(-halfSize * 0.45, 0.2, halfSize * 0.55);
            scene.add(gpBadge);

            // Picture Plane (PP) at z = 0, extending upwards (y >= 0)
            const ppGeo = new THREE.PlaneGeometry(halfSize * 1.1, halfSize * 0.85);
            const ppMat = new THREE.MeshBasicMaterial({
                color: 0xdbeafe,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.4,
                depthWrite: false,
            });
            const ppMesh = new THREE.Mesh(ppGeo, ppMat);
            ppMesh.position.set(0, halfSize * 0.85 / 2, 0);
            scene.add(ppMesh);

            const ppBorderGeo = new THREE.EdgesGeometry(ppGeo);
            const ppBorderMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 });
            const ppBorder = new THREE.LineSegments(ppBorderGeo, ppBorderMat);
            ppBorder.position.set(0, halfSize * 0.85 / 2, 0);
            scene.add(ppBorder);

            const ppBadge = createLabel('Picture Plane (P.P.)', 'plane-label');
            ppBadge.position.set(-halfSize * 0.45, halfSize * 0.8, 0.2);
            scene.add(ppBadge);
        } else {
            // HP Plane (X-Z plane, y = 0)
            const hpGeo = new THREE.PlaneGeometry(halfSize, halfSize);
            const hpMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.88,
                depthWrite: false,
            });
            const hpMesh = new THREE.Mesh(hpGeo, hpMat);
            hpMesh.rotation.x = -Math.PI / 2;
            hpMesh.position.set(0, 0, halfSize / 2);
            scene.add(hpMesh);

            const hpBorderGeo = new THREE.EdgesGeometry(hpGeo);
            const hpBorderMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
            const hpBorder = new THREE.LineSegments(hpBorderGeo, hpBorderMat);
            hpBorder.rotation.x = -Math.PI / 2;
            hpBorder.position.set(0, 0, halfSize / 2);
            scene.add(hpBorder);

            const hpGrid = new THREE.GridHelper(halfSize, 10, 0xc7d2fe, 0xe2e8f0);
            hpGrid.position.set(0, 0.05, halfSize / 2);
            scene.add(hpGrid);

            // VP Plane (X-Y plane, z = 0)
            const vpGeo = new THREE.PlaneGeometry(halfSize, halfSize);
            const vpMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.88,
                depthWrite: false,
            });
            const vpMesh = new THREE.Mesh(vpGeo, vpMat);
            vpMesh.position.set(0, halfSize / 2, 0);
            scene.add(vpMesh);

            const vpBorderGeo = new THREE.EdgesGeometry(vpGeo);
            const vpBorderMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
            const vpBorder = new THREE.LineSegments(vpBorderGeo, vpBorderMat);
            vpBorder.position.set(0, halfSize / 2, 0);
            scene.add(vpBorder);

            const vpGrid = new THREE.GridHelper(halfSize, 10, 0xc7d2fe, 0xe2e8f0);
            vpGrid.rotation.x = Math.PI / 2;
            vpGrid.position.set(0, halfSize / 2, -0.05);
            scene.add(vpGrid);

            // Ground Reference Line XY
            const xyLinePoints = [
                new THREE.Vector3(-halfSize * 0.58, 0, 0),
                new THREE.Vector3(halfSize * 0.58, 0, 0),
            ];
            const xyLineGeo = new THREE.BufferGeometry().setFromPoints(xyLinePoints);
            const xyLineMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 3 });
            const xyLine = new THREE.Line(xyLineGeo, xyLineMat);
            scene.add(xyLine);

            const xLabel = createLabel('X', 'xy-label');
            xLabel.position.set(-halfSize * 0.6, 0, 0);
            scene.add(xLabel);

            const yLabel = createLabel('Y', 'xy-label');
            yLabel.position.set(halfSize * 0.6, 0, 0);
            scene.add(yLabel);

            const hpBadge = createLabel('HP (Horizontal Plane)', 'plane-label');
            hpBadge.position.set(-halfSize * 0.35, 0.2, halfSize * 0.85);
            scene.add(hpBadge);

            const vpBadge = createLabel('VP (Vertical Plane)', 'plane-label');
            vpBadge.position.set(-halfSize * 0.35, halfSize * 0.85, 0.2);
            scene.add(vpBadge);
        }

        // 8. Filter and Render 3D Elements based on currentStep
        // Segments
        segments
            .filter((s) => (s.step || 1) <= currentStep)
            .forEach((seg) => {
                const pts = [
                    new THREE.Vector3(seg.start.x, seg.start.y, seg.start.z),
                    new THREE.Vector3(seg.end.x, seg.end.y, seg.end.z),
                ];
                const geo = new THREE.BufferGeometry().setFromPoints(pts);

                if (seg.style === 'dashed' || seg.role === 'projector' || seg.role === 'visual_ray') {
                    const lineMat = new THREE.LineDashedMaterial({
                        color: new THREE.Color(seg.color || '#94a3b8'),
                        dashSize: seg.role === 'visual_ray' ? 3.5 : 2.5,
                        gapSize: seg.role === 'visual_ray' ? 2 : 1.5,
                        linewidth: seg.role === 'visual_ray' ? 1.5 : 1.2,
                    });
                    const line = new THREE.Line(geo, lineMat);
                    line.computeLineDistances();
                    scene.add(line);
                } else if (seg.role === 'axis' || seg.role === 'horizon') {
                    const lineMat = new THREE.LineDashedMaterial({
                        color: new THREE.Color(seg.color || '#dc2626'),
                        dashSize: 6,
                        gapSize: 2,
                        linewidth: 2,
                    });
                    const line = new THREE.Line(geo, lineMat);
                    line.computeLineDistances();
                    scene.add(line);
                } else if (seg.role === 'cutting_plane') {
                    const lineMat = new THREE.LineDashedMaterial({
                        color: new THREE.Color(seg.color || '#dc2626'),
                        dashSize: 5,
                        gapSize: 2,
                        linewidth: 2,
                    });
                    const line = new THREE.Line(geo, lineMat);
                    line.computeLineDistances();
                    scene.add(line);
                } else if (seg.role === 'section') {
                    const lineMat = new THREE.LineBasicMaterial({
                        color: new THREE.Color(seg.color || '#b91c1c'),
                        linewidth: 3,
                    });
                    const line = new THREE.Line(geo, lineMat);
                    scene.add(line);
                } else {
                    const lineMat = new THREE.LineBasicMaterial({
                        color: new THREE.Color(seg.color || '#004d40'),
                        linewidth: 2.5,
                    });
                    const line = new THREE.Line(geo, lineMat);
                    scene.add(line);
                }
            });

        // Points & Markers
        const sphereGeo = new THREE.SphereGeometry(1.6, 16, 16);
        const sphereMat = new THREE.MeshStandardMaterial({
            color: 0x004d40,
            roughness: 0.3,
            metalness: 0.2,
        });

        const spSphereGeo = new THREE.SphereGeometry(3.0, 16, 16);
        const spSphereMat = new THREE.MeshStandardMaterial({
            color: 0xdc2626,
            roughness: 0.2,
            metalness: 0.3,
        });

        const pierceSphereGeo = new THREE.SphereGeometry(2.0, 16, 16);
        const pierceSphereMat = new THREE.MeshStandardMaterial({
            color: 0xb91c1c,
            roughness: 0.2,
            metalness: 0.3,
        });

        points
            .filter((p) => (p.step || 1) <= currentStep)
            .forEach((p) => {
                const isStation = p.role === 'station';
                const isPiercing = p.role === 'piercing';
                const marker = new THREE.Mesh(
                    isStation ? spSphereGeo : isPiercing ? pierceSphereGeo : sphereGeo,
                    isStation ? spSphereMat : isPiercing ? pierceSphereMat : sphereMat
                );
                marker.position.set(p.x, p.y, p.z);
                scene.add(marker);

                if (p.label) {
                    const labelObj = createLabel(p.label, isStation ? 'station-label' : isPiercing ? 'pierce-label' : 'vertex-label');
                    labelObj.position.set(p.x, p.y + (isStation ? 4 : 2.5), p.z);
                    scene.add(labelObj);
                }
            });

        // 3D Polygons (Cutting planes, Section surfaces, Laminas, Picture Plane)
        polygons
            .filter((poly) => (poly.step || 1) <= currentStep)
            .forEach((poly) => {
                if (poly.points.length < 3) return;

                const p0 = poly.points[0];
                const vertices: THREE.Vector3[] = [];
                for (let i = 1; i < poly.points.length - 1; i++) {
                    const p1 = poly.points[i];
                    const p2 = poly.points[i + 1];
                    vertices.push(new THREE.Vector3(p0.x, p0.y, p0.z));
                    vertices.push(new THREE.Vector3(p1.x, p1.y, p1.z));
                    vertices.push(new THREE.Vector3(p2.x, p2.y, p2.z));
                }

                const geo = new THREE.BufferGeometry().setFromPoints(vertices);
                geo.computeVertexNormals();

                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(poly.color),
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: poly.opacity,
                    depthWrite: false,
                });
                const mesh = new THREE.Mesh(geo, mat);
                scene.add(mesh);

                if (poly.label) {
                    const cx = poly.points.reduce((sum, p) => sum + p.x, 0) / poly.points.length;
                    const cy = poly.points.reduce((sum, p) => sum + p.y, 0) / poly.points.length;
                    const cz = poly.points.reduce((sum, p) => sum + p.z, 0) / poly.points.length;
                    const polyLabel = createLabel(poly.label, 'section-label');
                    polyLabel.position.set(cx, cy + 3, cz);
                    scene.add(polyLabel);
                }
            });

        // Dimensions in 3D
        dimensions
            .filter((dim) => (dim.step || 1) <= currentStep)
            .forEach((dim) => {
                const midX = (dim.p1.x + dim.p2.x) / 2;
                const midY = (dim.p1.y + dim.p2.y) / 2;
                const midZ = (dim.p1.z + dim.p2.z) / 2;

                const dimLabel = createLabel(dim.label, 'dimension-label');
                dimLabel.position.set(midX, midY + 3, midZ);
                scene.add(dimLabel);
            });

        // Angle Annotations in 3D
        angleAnnotations
            .filter((ann) => (ann.step || 1) <= currentStep)
            .forEach((ann) => {
                const arcGeo = new THREE.BufferGeometry();
                const arcPts: THREE.Vector3[] = [];
                const steps = 18;
                const v1 = new THREE.Vector3(ann.dirBase.x, ann.dirBase.y, ann.dirBase.z).normalize();
                const v2 = new THREE.Vector3(ann.dirInclined.x, ann.dirInclined.y, ann.dirInclined.z).normalize();

                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const v = new THREE.Vector3().lerpVectors(v1, v2, t).normalize().multiplyScalar(ann.radius);
                    arcPts.push(new THREE.Vector3(ann.origin.x + v.x, ann.origin.y + v.y, ann.origin.z + v.z));
                }
                arcGeo.setFromPoints(arcPts);
                const arcMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 });
                const arcLine = new THREE.Line(arcGeo, arcMat);
                scene.add(arcLine);

                const midPt = arcPts[Math.floor(steps / 2)];
                const textLabel = createLabel(ann.label, 'angle-label');
                textLabel.position.set(midPt.x, midPt.y + 2, midPt.z);
                scene.add(textLabel);
            });

        // 9. Camera Align View Transitions
        let animFrameId: number;
        const setViewAngle = (view: 'front' | 'top' | 'isometric' | 'side') => {
            const target = controls.target;
            const radius = camera.position.distanceTo(target);

            let newPos: THREE.Vector3;
            let newUp = new THREE.Vector3(0, 1, 0);

            if (view === 'front') {
                newPos = new THREE.Vector3(target.x, target.y, target.z + radius);
            } else if (view === 'top') {
                newPos = new THREE.Vector3(target.x, target.y + radius, target.z);
                newUp = new THREE.Vector3(0, 0, -1);
            } else if (view === 'side') {
                newPos = new THREE.Vector3(target.x - radius, target.y, target.z);
            } else {
                const isoR = d * 1.1;
                newPos = new THREE.Vector3(target.x + isoR * 0.7, target.y + isoR * 0.6, target.z + isoR * 0.8);
            }

            const startPos = camera.position.clone();
            const startUp = camera.up.clone();
            const startTime = performance.now();
            const duration = 650;

            const animateCam = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / duration);
                const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                camera.position.lerpVectors(startPos, newPos, ease);
                camera.up.lerpVectors(startUp, newUp, ease).normalize();
                camera.lookAt(target);
                controls.update();

                if (progress < 1) {
                    animFrameId = requestAnimationFrame(animateCam);
                }
            };
            cancelAnimationFrame(animFrameId);
            animFrameId = requestAnimationFrame(animateCam);
        };

        setViewAngleRef.current = setViewAngle;

        // 10. Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            if (!container) return;
            const newW = container.clientWidth;
            const newH = container.clientHeight;
            camera.aspect = newW / Math.max(newH, 1);
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
            labelRenderer.setSize(newW, newH);
        });
        resizeObserver.observe(container);

        // 11. Render Loop
        let frameId: number;
        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameId);
            cancelAnimationFrame(animFrameId);
            resizeObserver.disconnect();
            controls.dispose();
            renderer.dispose();
            container.innerHTML = '';
        };
    }, [sceneData, currentStep]);

    const activeStepInfo = sceneData?.stepsInfo.find((s) => s.step === currentStep) || sceneData?.stepsInfo[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 md:p-8 animate-in fade-in duration-200">
            <div className="relative flex flex-col w-full h-full max-w-6xl max-h-[92vh] bg-white border border-[#0b57ff] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#c7d7ff] bg-[#f7f9ff]">
                    <div className="flex items-center gap-3">
                        <img src="/logo-transparent.png" alt="Grafein Logo" className="w-8 h-8 object-contain" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-[#050816] tracking-wide">
                                    3D Spatial Projection View
                                </h2>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#edf3ff] text-[#0b57ff] border border-[#c7d7ff] font-semibold">
                                    grafein.in
                                </span>
                            </div>
                            <p className="text-xs text-[#4f5f85]">
                                {sceneData?.title} · {sceneData?.mode === 'perspective' ? 'Picture Plane (P.P.) & Ground Plane (G.P.)' : 'HP & VP Principal Planes'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="hidden md:inline-block text-xs text-[#4f5f85]">
                            Drag to rotate · Scroll to zoom · Right-click drag to pan
                        </span>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                            aria-label="Close 3D View"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Main 3D Canvas Area */}
                <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden bg-[#fafafa]">
                    {/* Step Description Card Overlay */}
                    {activeStepInfo && (
                        <div className="absolute top-4 left-4 z-10 max-w-md bg-white/95 backdrop-blur-xs border border-[#c7d7ff] p-3 shadow-md">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b57ff]">
                                    Step {activeStepInfo.step} of {sceneData?.maxStep}
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {sceneData?.mode === 'perspective' ? 'Ray Cone Construction' : '3D Construction'}
                                </span>
                            </div>
                            <h3 className="text-xs font-bold text-[#050816]">
                                {activeStepInfo.title}
                            </h3>
                            <p className="text-[11px] text-[#4f5f85] mt-0.5 leading-snug">
                                {activeStepInfo.description}
                            </p>
                        </div>
                    )}

                    {/* Step Navigation & View Controls Toolbar */}
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-3 bg-white/95 backdrop-blur-xs border border-[#c7d7ff] px-4 py-2 shadow-lg">
                        {/* 3D Step Controls */}
                        {sceneData && sceneData.maxStep > 1 && (
                            <div className="flex items-center gap-1.5 border-r border-[#c7d7ff] pr-3 mr-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                                    disabled={currentStep <= 1}
                                    className="px-2 py-1 text-xs font-bold bg-[#edf3ff] hover:bg-[#dbe7ff] text-[#050816] disabled:opacity-40 cursor-pointer"
                                    title="Previous 3D Step"
                                >
                                    ◀
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPlaying((p) => !p)}
                                    className="px-2.5 py-1 text-xs font-semibold bg-[#0b57ff] hover:bg-[#0047d4] text-white cursor-pointer"
                                    title={isPlaying ? 'Pause Animation' : 'Play 3D Step Animation'}
                                >
                                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep((prev) => Math.min(sceneData.maxStep, prev + 1))}
                                    disabled={currentStep >= sceneData.maxStep}
                                    className="px-2 py-1 text-xs font-bold bg-[#edf3ff] hover:bg-[#dbe7ff] text-[#050816] disabled:opacity-40 cursor-pointer"
                                    title="Next 3D Step"
                                >
                                    ▶
                                </button>
                                <span className="text-xs font-mono font-bold text-[#050816] ml-1">
                                    {currentStep}/{sceneData.maxStep}
                                </span>
                            </div>
                        )}

                        {/* View Presets */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-[#4f5f85] uppercase mr-1">
                                Align:
                            </span>
                            <button
                                type="button"
                                onClick={() => setViewAngleRef.current?.('front')}
                                className="px-2.5 py-1 text-xs font-semibold text-[#050816] bg-[#edf3ff] hover:bg-[#0b57ff] hover:text-white transition-colors cursor-pointer"
                            >
                                {sceneData?.mode === 'perspective' ? 'Picture Plane (PP)' : 'Front (FV)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewAngleRef.current?.('top')}
                                className="px-2.5 py-1 text-xs font-semibold text-[#050816] bg-[#edf3ff] hover:bg-[#0b57ff] hover:text-white transition-colors cursor-pointer"
                            >
                                {sceneData?.mode === 'perspective' ? 'Plan View (GP)' : 'Top (TV)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewAngleRef.current?.('side')}
                                className="px-2.5 py-1 text-xs font-semibold text-[#050816] bg-[#edf3ff] hover:bg-[#0b57ff] hover:text-white transition-colors cursor-pointer"
                            >
                                Side (Profile)
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewAngleRef.current?.('isometric')}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0b57ff] hover:bg-[#0047d4] transition-colors cursor-pointer"
                            >
                                3D Orbit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Hotfix: Initialize 3D Orbit View renderer and canvas

// Calibrate orbit controls damping and target origin pivot

// Add directional key light and ambient fill for solid projection visualization
