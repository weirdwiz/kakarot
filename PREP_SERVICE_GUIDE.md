## Meeting Prep Service - Implementation Guide

### Overview
The Meeting Prep Service generates deterministic 5-minute meeting briefings using OpenAI Agent, integrating participant history from past meetings to provide context-aware talking points, questions, and strategic recommendations.

---

## Architecture

### Backend Components

#### 1. **PrepService** (`src/main/services/PrepService.ts`)
The core service handling all prep generation logic.

**Key Method:**
```typescript
async generateMeetingPrep(input: GenerateMeetingPrepInput): Promise<MeetingPrepOutput>
```

**Input Contract:**
```typescript
interface GenerateMeetingPrepInput {
  meeting: {
    meeting_type: string;      // e.g., "sales call", "product sync", "board meeting"
    objective: string;          // e.g., "Discuss Q1 roadmap"
  };
  participants: [
    {
      name: string;
      email: string | null;      // Primary identifier
      company: string | null;
      domain: string | null;     // Fallback if email missing
    }
  ];
}
```

**Output Contract:**
```typescript
interface MeetingPrepOutput {
  meeting: {
    type: string;
    objective: string;
    duration_minutes: 5;
  };
  generated_at: string;          // ISO8601 timestamp
  participants: ParticipantPrepSection[];
  agenda: {
    opening: string;
    key_topics: string[];
    closing: string;
  };
  success_metrics: string[];
  risk_mitigation: string[];
}
```

#### 2. **ParticipantPrepSection** Structure
Generated per-participant briefing:
```typescript
interface ParticipantPrepSection {
  name: string;
  email: string | null;
  history_strength: 'strong' | 'weak' | 'org-only' | 'none';
  context: {
    last_meeting_date: string | null;
    meeting_count: number;
    recent_topics: string[];
    key_points: string[];
  };
  talking_points: string[];       // 2-3 per participant
  questions_to_ask: string[];     // 1-2 per participant
  background: string;              // 1-2 sentence summary
}
```

---

## Retrieval Logic

### Participant History Matching

The service implements a 4-tier strength classification:

| Strength | Criteria | Example |
|----------|----------|---------|
| **strong** | Email match + 3+ meetings OR email match + meeting < 2 weeks ago | Regular collaborators |
| **weak** | Email match + 1-2 meetings | Occasional contacts |
| **org-only** | Domain match (no email) | Same organization, new contact |
| **none** | No email, no domain, or no history | Cold outreach |

### Meeting Filtering

```typescript
// Rule 1: Exact email match (highest priority)
if (participant.email) {
  filter meetings where attendeeEmails includes participant.email
}

// Rule 2: Domain-based fallback
if (!participant.email && participant.domain) {
  filter meetings where any attendeeEmail ends with @participant.domain
}

// Rule 3: No history if neither email nor domain
return []
```

### Context Extraction

- **Recent Meetings**: Last 5 meetings per participant
- **Topics**: Extracted from meeting titles (de-duplicated)
- **Key Points**: 
  - Action items (max 2 per meeting)
  - Transcript snippets from "system" source (other participants)

---

## IPC Integration

### Handler Registration
```typescript
// Automatically registered in registerAllHandlers()
ipcMain.handle(
  IPC_CHANNELS.PREP_GENERATE_BRIEFING,
  async (_event, input: GenerateMeetingPrepInput): Promise<MeetingPrepOutput>
)
```

### IPC Channel
```typescript
PREP_GENERATE_BRIEFING: 'prep:generateBriefing'
```

---

## Frontend Usage

### Renderer API
```typescript
// Call from React component
const result = await window.kakarot.prep.generateBriefing({
  meeting: {
    meeting_type: "sales call",
    objective: "Discuss pricing and contract terms"
  },
  participants: [
    {
      name: "Alice Johnson",
      email: "alice@acme.com",
      company: "Acme Corp",
      domain: "acme.com"
    },
    {
      name: "Bob Smith",
      email: null,
      company: "TechVentures",
      domain: "techventures.io"
    }
  ]
});
```

### Response Example
```json
{
  "meeting": {
    "type": "sales call",
    "objective": "Discuss pricing and contract terms",
    "duration_minutes": 5
  },
  "generated_at": "2026-01-13T10:30:00Z",
  "participants": [
    {
      "name": "Alice Johnson",
      "email": "alice@acme.com",
      "history_strength": "strong",
      "context": {
        "last_meeting_date": "2026-01-10",
        "meeting_count": 7,
        "recent_topics": ["Q1 budget review", "Integration requirements", "Implementation timeline"],
        "key_points": ["Approved $50K budget", "Q2 deployment target"]
      },
      "talking_points": [
        "Reference previous positive feedback on product demo",
        "Highlight integration capability with their existing systems",
        "Mention expanded feature set since last meeting"
      ],
      "questions_to_ask": [
        "What timeline are they looking at for implementation?",
        "Are there any concerns from the finance team about pricing?"
      ],
      "background": "Alice has been a consistent stakeholder in 7 meetings over 4 months. Strong technical background with focus on integration requirements."
    }
  ],
  "agenda": {
    "opening": "Thank Alice for taking the time. Briefly recap product value and our success with similar orgs.",
    "key_topics": ["Pricing alignment", "Contract terms clarification", "Implementation support", "Next steps"],
    "closing": "Confirm next steps, establish timeline, and schedule follow-up with legal/procurement teams."
  },
  "success_metrics": [
    "Agreement on pricing within target range",
    "Contract terms accepted without significant revisions",
    "Implementation kickoff scheduled"
  ],
  "risk_mitigation": [
    "Budget constraints - have flexible tier options ready",
    "Contract delays - prepare concise summary of non-negotiable terms",
    "Integration concerns - have technical architect on standby"
  ]
}
```

---

## Implementation in PrepView

### Example Integration

```typescript
import { useState } from 'react';
import type { GenerateMeetingPrepInput, MeetingPrepOutput } from '@main/services/PrepService';

export function PrepBriefingGenerator() {
  const [prep, setPrep] = useState<MeetingPrepOutput | null>(null);
  const [loading, setLoading] = useState(false);

  async function generatePrep() {
    setLoading(true);
    try {
      const result = await window.kakarot.prep.generateBriefing({
        meeting: {
          meeting_type: "sales call",
          objective: "Discuss partnership opportunities"
        },
        participants: [
          {
            name: "Jane Doe",
            email: "jane@company.com",
            company: "Company Inc",
            domain: "company.com"
          }
        ]
      });
      setPrep(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={generatePrep} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Briefing'}
      </button>
      
      {prep && (
        <div>
          <h2>{prep.meeting.type}</h2>
          <p>{prep.meeting.objective}</p>
          
          {prep.participants.map(p => (
            <section key={p.email || p.name}>
              <h3>{p.name}</h3>
              <p>History: {p.history_strength}</p>
              <h4>Talking Points:</h4>
              <ul>
                {p.talking_points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
              <h4>Questions to Ask:</h4>
              <ul>
                {p.questions_to_ask.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## OpenAI Agent Configuration

The service uses GPT-4o with:
- **Temperature**: 0.7 (balanced creativity/determinism)
- **Max Tokens**: 2000 (sufficient for rich output)
- **Response Format**: JSON (structured output)

### Agent Prompt Structure
The prompt includes:
1. Meeting type and objective
2. Per-participant context with history strength labels
3. Recent topics and key points
4. Instructions for 5-minute format enforcement
5. JSON schema specification

---

## Error Handling

```typescript
try {
  const prep = await window.kakarot.prep.generateBriefing(input);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('AI provider not configured')) {
      // Handle missing OpenAI API key
    } else if (error.message.includes('Invalid prep output')) {
      // Handle malformed AI response
    } else {
      // Log other errors
      console.error('Prep generation failed:', error.message);
    }
  }
}
```

---

## Performance Characteristics

- **Meeting Retrieval**: O(n) where n = total meetings in database
- **Context Extraction**: O(m × k) where m = participant count, k = avg meetings per participant
- **OpenAI Call**: ~2-5 seconds depending on network
- **Total Latency**: ~3-7 seconds for typical use case

### Optimization Tips
- Cache recent meeting summaries
- Pre-compute domain-to-email mappings for org-level lookups
- Batch multiple prep requests if generating briefings for larger teams

---

## Testing

### Unit Test Example
```typescript
const input: GenerateMeetingPrepInput = {
  meeting: {
    meeting_type: "board meeting",
    objective: "Q4 review"
  },
  participants: [
    {
      name: "CEO",
      email: "ceo@company.com",
      company: "Company",
      domain: "company.com"
    }
  ]
};

const result = await prepService.generateMeetingPrep(input);

expect(result.meeting.duration_minutes).toBe(5);
expect(result.participants[0].history_strength).toMatch(/strong|weak|org-only|none/);
expect(Array.isArray(result.success_metrics)).toBe(true);
```

---

## Future Enhancements

1. **Caching**: Cache prep outputs per unique (meeting_type, participants) combo
2. **Streaming**: Stream participant sections as they're generated
3. **Custom Prompts**: Allow users to customize agent instructions
4. **Meeting Type Templates**: Pre-built optimizations for common meeting types
5. **Sentiment Analysis**: Extract emotional context from past conversations
6. **Cross-org Patterns**: Learn from similar meetings across organization

---

## Files Modified

- ✅ `src/main/services/PrepService.ts` - Core service (new)
- ✅ `src/main/handlers/prepHandlers.ts` - IPC handlers (new)
- ✅ `src/main/core/container.ts` - DI container update
- ✅ `src/main/handlers/index.ts` - Handler registration
- ✅ `src/shared/ipcChannels.ts` - IPC channel definition
- ✅ `src/preload/index.ts` - Renderer API exposure
