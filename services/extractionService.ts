import { EngineeringProblem } from '../types';
import { parseProblemLocally } from '../lib/nlpParser';

export const extractParameters = async (text: string): Promise<EngineeringProblem> => {
    try {
        const localParsed = parseProblemLocally(text);
        if (localParsed && !('error' in localParsed)) {
            console.log(`[NLP Layer] Extracted "${localParsed.type}" locally in <1ms.`);
            return localParsed;
        }
        return { error: 'Failed to understand the problem description. Please rephrase.' };
    } catch (err: any) {
        console.error('[NLP Layer] Local parsing error:', err);
        return { error: err?.message || 'Failed to extract parameters.' };
    }
};
