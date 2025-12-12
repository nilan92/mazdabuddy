export const generateDiagnosis = async (apiKey: string, vehicle: string, description: string, symptoms: string) => {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://mazdabuddy.com", // Optional, simplified
                "X-Title": "MazdaBuddy", // Optional
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-exp:free", // Using a free or cheap model default
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert automotive technician assistant. Provide concise, potential diagnoses and a checklist of 3-5 things to check based on the vehicle and reported issue. Keep it professional and short."
                    },
                    {
                        "role": "user",
                        "content": `Vehicle: ${vehicle}\nIssue: ${description}\nNotes: ${symptoms}`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`AI API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "No diagnosis generated.";

    } catch (error) {
        console.error("AI Service Error:", error);
        throw error;
    }
};
