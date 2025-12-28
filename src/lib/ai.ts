export const generateDiagnosis = async (apiKey: string, vehicle: string, description: string, symptoms: string) => {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://mazdabuddy.com",
                "X-Title": "MazdaBuddy",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-exp:free",
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

export const analyzeVehicleImage = async (apiKey: string, base64Image: string) => {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://mazdabuddy.com",
                "X-Title": "AutoPulse",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-pro-exp-02-05:free", // Use pro for better vision
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Analyze this vehicle image. Extract the following information in JSON format: { \"licensePlate\": \"string\", \"make\": \"string\", \"model\": \"string\", \"color\": \"string\" }. If you can't see something, put 'Unknown'. Be very accurate even if the image is blurry."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": base64Image
                                }
                            }
                        ]
                    }
                ],
                "response_format": { "type": "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`AI API Error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        return JSON.parse(content);

    } catch (error) {
        console.error("AI Vision Error:", error);
        throw error;
    }
};
