import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { extractParameters } from './services/extractionService';
import { GeometryEngine } from './lib/geometryEngine';
import { SvgRenderer } from './components/SvgRenderer';
import { TeachingControls } from './components/TeachingControls';
import { ThreeDViewModal } from './components/ThreeDViewModal';
import { GeometryOutput } from './types';
import { EXAMPLES } from './lib/examples';

import { Box } from 'lucide-react';



const COMMON_EXAMPLE_TITLES = new Set([
    'Point',
    'Line Inclined Both',
    'Vertical Rectangular Lamina',
    'Simple Solid',
    'Inclined Solid (Both)'
]);

const MOBILE_EXAMPLE_TITLES = new Set([
    'Line Inclined Both',
    'Inclined Solid (Both)',
]);

export const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<'landing' | 'studio'>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'studio') return 'studio';
        }
        return 'studio';
    });
    const [sidebarTab, setSidebarTab] = useState<'bank' | 'solver'>('bank');
    const [inputText, setInputText] = useState<string>('');
    const [geometryOutput, setGeometryOutput] = useState<GeometryOutput | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [rendererKey, setRendererKey] = useState(0);
    const [isTeachingMode, setIsTeachingMode] = useState(false);
    const [currentSequence, setCurrentSequence] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [is3DViewOpen, setIs3DViewOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('orbit') === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'studio' && !geometryOutput) {
                handleExampleClick(EXAMPLES[1].query);
            }
        }
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 760px)');
        const updateIsMobile = (event?: MediaQueryListEvent) => {
            setIsMobile(event ? event.matches : mediaQuery.matches);
        };

        updateIsMobile();
        mediaQuery.addEventListener('change', updateIsMobile);

        return () => mediaQuery.removeEventListener('change', updateIsMobile);
    }, []);

    const totalSteps = useMemo(() => {
        if (!geometryOutput || !geometryOutput.constructionPrimitives) {
            return 0;
        }

        return Math.max(...geometryOutput.constructionPrimitives.map((primitive) => primitive.step || 0));
    }, [geometryOutput]);

    const totalSequences = useMemo(() => {
        if (!geometryOutput || !geometryOutput.constructionPrimitives.length) {
            return 0;
        }

        return Math.max(...geometryOutput.constructionPrimitives.map((primitive) => primitive.sequence || 0));
    }, [geometryOutput]);

    const visibleExamples = useMemo(() => {
        const commonExamples = EXAMPLES.filter((example) => COMMON_EXAMPLE_TITLES.has(example.title));
        return isMobile
            ? commonExamples.filter((example) => MOBILE_EXAMPLE_TITLES.has(example.title))
            : commonExamples;
    }, [isMobile]);

    const generateFromText = useCallback(async (problemText: string) => {
        if (!problemText.trim()) {
            setError('Please enter a problem description.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeometryOutput(null);
        setCurrentSequence(0);
        setRendererKey((prev) => prev + 1);

        const extractedJson = await extractParameters(problemText);

        if (extractedJson && 'error' in extractedJson) {
            setError(extractedJson.error);
        } else if (extractedJson) {
            const geometry = new GeometryEngine().generateGeometry(extractedJson);
            setGeometryOutput(geometry);

            if (geometry.error) {
                setError(geometry.error);
            }
        } else {
            setError('An unknown error occurred during parameter extraction.');
        }

        setIsLoading(false);
    }, []);

    const handleGenerate = useCallback(async () => {
        await generateFromText(inputText);
    }, [generateFromText, inputText]);

    const handleExampleClick = async (exampleQuery: string) => {
        const example = EXAMPLES.find((entry) => entry.query === exampleQuery);
        setInputText(exampleQuery);
        setError(null);

        if (example) {
            setIsLoading(true);
            setGeometryOutput(null);
            setCurrentSequence(0);
            setRendererKey((prev) => prev + 1);
            const geometry = new GeometryEngine().generateGeometry(example.parsed);
            setGeometryOutput(geometry);
            setError(geometry.error || null);
            setIsLoading(false);
            return;
        }

        await generateFromText(exampleQuery);
    };

    

    return (
        <div className="app-shell workspace-shell">
            <header className="workspace-navbar !py-2 !px-4 flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                    {geometryOutput && (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#edf3ff] text-[#0b57ff] border border-[#c7d7ff] font-semibold hidden md:inline">
                            {(geometryOutput.params as any)?.type?.replace(/_/g, ' ')?.toUpperCase() || 'ORTHOGRAPHIC PROJECTION'}
                        </span>
                    )}
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#050816] text-white font-bold text-xs flex items-center justify-center">
                        G
                    </div>
                    <span className="font-bold text-xs uppercase tracking-widest text-[#050816]">STUDIO</span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {geometryOutput && totalSteps > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setIs3DViewOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b57ff] hover:bg-[#0047d4] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                                title="Open 3D Spatial Projection View"
                            >
                                <Box className="w-3.5 h-3.5" />
                                <span>3D Orbit View</span>
                            </button>

                            <div className="toggle-cluster hidden sm:flex">
                                <span className="toggle-label text-xs">Teaching Mode</span>
                                <label className="switch" aria-label="Toggle teaching mode">
                                    <input
                                        id="teachingModeToggle"
                                        type="checkbox"
                                        checked={isTeachingMode}
                                        onChange={(event) => setIsTeachingMode(event.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>
                        </>
                    )}
                </div>
            </header>

            <main className="workspace-grid">
                <section className="panel panel-input">
                    {/* Studio Sidebar Tabs */}
                    <div className="flex items-center border-b border-[#050816]/10 mb-3 bg-[#edf3ff]/60 p-1 gap-1">
                        <button
                            onClick={() => setSidebarTab('bank')}
                            className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                                sidebarTab === 'bank'
                                    ? 'bg-[#050816] text-white shadow-xs'
                                    : 'text-[#4f5f85] hover:text-[#050816]'
                            }`}
                        >
                            Curriculum Bank
                        </button>
                        <button
                            onClick={() => setSidebarTab('solver')}
                            className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                                sidebarTab === 'solver'
                                    ? 'bg-[#050816] text-white shadow-xs'
                                    : 'text-[#4f5f85] hover:text-[#050816]'
                            }`}
                        >
                            Custom Question Solver
                        </button>
                    </div>

                    {sidebarTab === 'bank' ? (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[#4f5f85] uppercase tracking-wider">
                                    Standard Exam Problems
                                </span>
                                <span className="text-[9px] font-mono text-[#0b57ff] bg-[#edf3ff] px-1.5 py-0.5 border border-[#c7d7ff] font-bold">
                                    ISO 128
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                                {visibleExamples.map((example) => (
                                    <button
                                        key={example.title}
                                        onClick={() => handleExampleClick(example.query)}
                                        className={`w-full text-left p-2.5 border transition-all cursor-pointer ${
                                            inputText === example.query
                                                ? 'border-[#0b57ff] bg-[#edf3ff] text-[#050816]'
                                                : 'border-gray-200 bg-white hover:border-[#0b57ff]/40 text-[#4f5f85]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-[#050816] block uppercase tracking-tight">
                                                {example.title}
                                            </span>
                                            <span className="text-[9px] text-[#0b57ff] font-mono uppercase font-semibold">
                                                {(example.parsed as any)?.type?.split('_')[0] || 'VIEW'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 line-clamp-2 mt-1 font-sans">
                                            {example.query}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[#4f5f85] uppercase tracking-wider">
                                    Custom Question Solver
                                </span>
                                <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 border border-emerald-200 font-bold">
                                    &lt;1ms Local Compute
                                </span>
                            </div>
                            <textarea
                                value={inputText}
                                onChange={(event) => setInputText(event.target.value)}
                                placeholder="Paste or type any engineering exam question (e.g. A square pyramid base 35mm, axis 70mm rests on an edge of its base on HP...)"
                                className="problem-input text-xs"
                                rows={6}
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="primary-button text-xs font-bold uppercase tracking-wider"
                            >
                                {isLoading ? 'Analyzing & Drafting...' : 'Draft Projection'}
                            </button>
                        </div>
                    )}
                </section>

                <section className="panel panel-output">
                    <div className="panel-header-row">
                        <div className="panel-section compact-section">
                            <p className="section-kicker">02 / Output</p>
                            <h2 className="section-title">Projection workspace</h2>
                        </div>
                    </div>

                    {isLoading && <div className="status-box">Analyzing and drawing...</div>}
                    {error && <div className="error-box">{error}</div>}

                    {geometryOutput && geometryOutput.constructionPrimitives.length > 2 ? (
                        <div className="output-stack">
                            <div className="output-canvas">
                                <SvgRenderer
                                    key={rendererKey}
                                    geometry={geometryOutput}
                                    isTeachingMode={isTeachingMode}
                                    currentSequence={isTeachingMode ? currentSequence : totalSequences}
                                    totalSequences={totalSequences}
                                    totalStages={totalSteps}
                                    onSequenceChange={setCurrentSequence}
                                    lineProperties={geometryOutput.lineProperties}
                                />
                            </div>

                            {isTeachingMode && totalSteps > 0 && (
                                <div className="output-steps">
                                    <TeachingControls
                                        currentSequence={currentSequence}
                                        totalSteps={totalSteps}
                                        onSequenceChange={setCurrentSequence}
                                        problemType={geometryOutput.type}
                                        geometry={geometryOutput}
                                    />
                                </div>
                            )}
                        </div>
                    ) : !isLoading && !error ? (
                        <div className="empty-state">
                            <img src="/logo-transparent.png" alt="Grafein Logo" className="empty-logo" />
                            <p className="empty-title">Welcome to Grafein · grafein.in</p>
                            <p className="empty-copy">Submit a prompt or choose an example above to generate projections with step-by-step engineering drawing instructions.</p>
                        </div>
                    ) : null}
                </section>
            </main>

            <p className="mobile-desktop-note">This app works better on desktop.</p>

            {is3DViewOpen && geometryOutput && (
                <ThreeDViewModal
                    geometry={geometryOutput}
                    onClose={() => setIs3DViewOpen(false)}
                />
            )}
        </div>
    );
};
