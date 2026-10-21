# Product Brief — Semantic Phrase Validator

| Field | Value |
|---|---|
| Project | Semantic Phrase Validator |
| Document | Product Brief |
| Version | 0.1.0 |
| Status | Draft — Pending Human Approval |
| Methodology | AI-First / Human-in-the-Loop |
| Source | `reto-original.md` |
| Last Updated | [YYYY-MM-DD] |

---

## 1. Product Overview

### 1.1 Problem Statement

Users need a simple application to register short phrases while identifying potentially duplicated content based on semantic meaning rather than exact text matching.

### 1.2 Product Vision

Provide an intuitive web application that helps users manage phrases and detect semantically similar entries before saving them.

### 1.3 Product Goals

- Allow users to register and visualize phrases.
- Detect potential semantic duplicates using AI.
- Provide understandable similarity results.
- Allow users to confirm or cancel potentially duplicated entries.

### 1.4 Success Criteria

| ID | Criterion | Verification |
|---|---|---|
| SC-001 | Users can register and list phrases | Functional tests |
| SC-002 | Similar phrases are identified semantically | AI evaluation tests |
| SC-003 | Users can confirm or cancel duplicates | Acceptance tests |
| SC-004 | Validation metadata is persisted | Integration tests |

---

## 2. Target Users & Actors

| Actor | Description | Main Need |
|---|---|---|
| End User | Person who registers phrases | Detect potential duplicates before saving |

**Open Questions**
- [PENDING] Is authentication required?
- [PENDING] Are phrases shared between users?

---

## 3. Product Scope

### 3.1 In Scope

- Phrase registration.
- Phrase listing.
- Semantic similarity validation.
- Configurable similarity threshold.
- Potential duplicate detection.
- User confirmation or cancellation.
- Persistence of phrases and validation metadata.
- Basic error handling.

### 3.2 Out of Scope

[To be defined and approved during Discovery.]

### 3.3 Optional Enhancements

| Enhancement | Status |
|---|---|
| Content moderation guardrails | PROPOSED |
| Personal data detection | PROPOSED |
| Authentication | PENDING |
| Phrase search and filtering | PROPOSED |

Optional enhancements must not become requirements without approval.

---

## 4. Functional Requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-001 | Register a new phrase | Must | CONFIRMED |
| FR-002 | List previously saved phrases | Must | CONFIRMED |
| FR-003 | Validate semantic similarity before saving | Must | CONFIRMED |
| FR-004 | Identify the most similar stored phrase | Must | CONFIRMED |
| FR-005 | Display the similarity score | Must | CONFIRMED |
| FR-006 | Warn users about potential duplicates | Must | CONFIRMED |
| FR-007 | Allow users to confirm or cancel saving | Must | CONFIRMED |
| FR-008 | Persist phrases and validation metadata | Must | CONFIRMED |

Requirements should describe expected behavior, not implementation details.

---

## 5. User Flows

### UF-001 — Register a New Phrase

**Actor:** End User

**Precondition:** Application is available.

**Main Flow:**
1. User opens the application.
2. User enters a new phrase.
3. User requests similarity validation.
4. System compares the phrase with existing entries.
5. System displays the validation result.
6. User proceeds according to the result.
7. System saves the phrase when authorized.
8. Application updates the phrase list.

**Alternative Flows:**
- No similar phrase found.
- Potential duplicate detected.
- User cancels the operation.
- Validation fails.
- No previously saved phrases exist.

### UF-002 — View Saved Phrases

**Main Flow:**
1. User opens the application.
2. System retrieves saved phrases.
3. User views the list.

**Alternative Flows:**
- No phrases exist.
- Data retrieval fails.

---

## 6. Business Rules

| ID | Rule | Status |
|---|---|---|
| BR-001 | Semantic similarity must be evaluated using AI | CONFIRMED |
| BR-002 | Similarity must not rely exclusively on exact text matching | CONFIRMED |
| BR-003 | The similarity threshold must be configurable | CONFIRMED |
| BR-004 | Potential duplicates require a warning and a user decision | CONFIRMED |
| BR-005 | Define whether users can save without previously pressing Validate | PENDING |
| BR-006 | Define behavior when semantic validation fails | PENDING |
| BR-007 | Define permitted phrase length and content restrictions | PENDING |

---

## 7. AI Functional Requirements

### 7.1 Semantic Validation

**Objective:** Detect potential duplicates based on sentence meaning.

**Required Behavior:**
- Generate embeddings for phrases.
- Compare a new phrase against stored phrases.
- Calculate similarity scores.
- Identify the most similar phrase.
- Evaluate a configurable threshold.
- Return a validation result to the user.

### 7.2 Expected Validation Result

| Field | Description |
|---|---|
| `isPotentialDuplicate` | Indicates a possible duplicate |
| `similarityScore` | Calculated similarity |
| `matchedPhrase` | Most similar existing phrase |
| `validationStatus` | Validation outcome |

*This is a conceptual response, not an approved API schema.*

### 7.3 AI Decisions to Confirm

| Decision | Status |
|---|---|
| Similarity threshold value | PENDING |
| Behavior when no phrases exist | PENDING |
| Handling of false positives | PENDING |
| AI service failure behavior | PENDING |

Model selection, vector database design and integration patterns belong to technical planning.

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Status |
|---|---|---|---|
| NFR-001 | Usability | Simple and understandable interface | CONFIRMED |
| NFR-002 | Reliability | Clear error handling and response structure | CONFIRMED |
| NFR-003 | Maintainability | Separation of responsibilities | CONFIRMED |
| NFR-004 | Documentation | Documented REST API | CONFIRMED |
| NFR-005 | Performance | Define acceptable validation response time | PENDING |
| NFR-006 | Security | Define input and abuse protection requirements | PENDING |
| NFR-007 | Testing | Validate critical application workflows | CONFIRMED |

---

## 9. Acceptance Criteria

### AC-001 — Successful Phrase Registration

**Given** a user has entered a valid phrase,  
**When** the required validation and save conditions are satisfied,  
**Then** the system persists the phrase and displays it in the list.

### AC-002 — Potential Duplicate Detection

**Given** a semantically similar phrase already exists,  
**When** the user validates a new phrase,  
**Then** the application displays a potential duplicate warning, the matched phrase and its similarity score.

### AC-003 — User Cancels Registration

**Given** a potential duplicate has been detected,  
**When** the user cancels the operation,  
**Then** the new phrase must not be saved.

### AC-004 — User Confirms Registration

**Given** a potential duplicate has been detected,  
**When** the user explicitly confirms saving,  
**Then** the application saves the phrase and its required metadata.

Additional criteria should be defined after resolving pending decisions.

---

## 10. Edge Cases & Error Scenarios

| Scenario | Expected Behavior | Status |
|---|---|---|
| Empty phrase | Reject invalid input | PENDING |
| Exact duplicate | Detect and notify | PENDING |
| Semantically similar phrase | Warn and request confirmation | CONFIRMED |
| No existing phrases | Define validation outcome | PENDING |
| AI processing failure | Define fallback or error behavior | PENDING |
| Database failure | Display a clear error | PENDING |
| Text modified after validation | Define revalidation behavior | PENDING |
| Concurrent registrations | Define consistency requirements | PENDING |

---

## 11. Decisions Log

| ID | Decision | Rationale | Status |
|---|---|---|---|
| DEC-001 | [Decision description] | [Why selected] | CONFIRMED / PENDING |
| DEC-002 | [Decision description] | [Why selected] | CONFIRMED / PENDING |

All decisions must be explicitly approved by the product owner.

---

## 12. Open Questions

| ID | Question | Recommendation | Status |
|---|---|---|---|
| Q-001 | Is validation mandatory before saving? | [Agent recommendation] | PENDING |
| Q-002 | What happens when the AI service fails? | [Agent recommendation] | PENDING |
| Q-003 | What similarity threshold should be used? | [Evaluate during AI feasibility] | PENDING |

Resolve blocking questions before approving the document.

---

## 13. Discovery Approval

**Review Checklist**

- [ ] Product objectives reviewed
- [ ] Functional requirements approved
- [ ] Business rules approved
- [ ] User flows validated
- [ ] Scope confirmed
- [ ] Blocking ambiguities resolved
- [ ] Acceptance criteria reviewed

**Approval Status:** PENDING

**Approved By:** [Product Owner]

**Approval Date:** [YYYY-MM-DD]

---

## 14. Next Steps

Upon approval, this document becomes an input for:

1. AI Feasibility & Model Evaluation
2. UX/UI Design in Figma
3. Technical Architecture & API Contracts
4. Spec-Driven Development with Spec Kit

Any change to an approved requirement must be reviewed and reflected in the relevant downstream artifacts.