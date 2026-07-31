import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

let embeddingModel = null;

async function initEmbeddingModel() {
    if (!embeddingModel) {
        console.log("Loading local embedding model...");
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            dtype: 'q8'
        });
        console.log("Embedding model loaded!");
    }
    return embeddingModel;
}

export async function getEmbedding(text) {
    const model = await initEmbeddingModel();
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

export async function setupGpuDataset(rawGpuLines) {
    const cachedData = localStorage.getItem('gpu_embeddings_cache');
    let processedGpuDataset = [];

    if (cachedData) {
        processedGpuDataset = JSON.parse(cachedData);
        console.log("Loaded GPU embeddings from localStorage.");
    } else {
        console.log("First time setup: Generating vector embeddings for GPUs...");
        for (const line of rawGpuLines) {
            if (!line.trim()) continue;
            try {
                const gpu = JSON.parse(line);
                if (!gpu.text || typeof gpu.text !== 'string') {
                    console.warn("Skipping line with missing or invalid text property:", line);
                    continue;
                }

                const vector = await getEmbedding(gpu.text);

                processedGpuDataset.push({
                    ...gpu,
                    embedding: vector
                });
            } catch {
                console.log("an error occured while looking for gpus")
            }
        }
        localStorage.setItem('gpu_embeddings_cache', JSON.stringify(processedGpuDataset));
        console.log("Embeddings generated and cached successfully!");
    }

    return processedGpuDataset;
}

export function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
}

export async function semanticSearch(userQuery, gpuDataset, topK = 3) {
    const queryVector = await getEmbedding(userQuery);
    const scored = gpuDataset.map(item => {
        const score = cosineSimilarity(queryVector, item.embedding);
        return { ...item, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}