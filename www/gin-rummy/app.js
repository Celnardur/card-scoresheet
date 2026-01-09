/* global m */

const STORAGE_KEY = "card_scoresheet_gin_rummy"

const defaultState = () => ({
  players: [
    { id: 1, name: "Player 1" },
    { id: 2, name: "Player 2" },
  ],
  rounds: [],
  nextPlayerId: 3,
  nextRoundId: 1,
})

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.players)) return defaultState()
    return {
      players: parsed.players,
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      nextPlayerId:
        typeof parsed.nextPlayerId === "number"
          ? parsed.nextPlayerId
          : parsed.players.length + 1,
      nextRoundId:
        typeof parsed.nextRoundId === "number"
          ? parsed.nextRoundId
          : (Array.isArray(parsed.rounds) ? parsed.rounds.length : 0) + 1,
    }
  } catch (err) {
    return defaultState()
  }
}

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const state = loadState()
const uiState = {
  draftKnockerId: null,
  draftDeadwood: {},
  draftBigGin: false,
}

const ensureDraftDeadwood = (players) => {
  players.forEach((player) => {
    if (!(player.id in uiState.draftDeadwood)) {
      uiState.draftDeadwood[player.id] = ""
    }
  })
}

const resetDraft = (players) => {
  uiState.draftKnockerId = players.length > 0 ? players[0].id : null
  uiState.draftDeadwood = {}
  ensureDraftDeadwood(players)
  uiState.draftBigGin = false
}

const parseNonNegative = (value) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Math.max(0, Math.floor(numberValue))
}

const buildRoundOutcome = (players) => {
  if (players.length !== 2) return null
  if (!uiState.draftKnockerId) return null
  const knockerId = uiState.draftKnockerId
  const opponent = players.find((player) => player.id !== knockerId)
  if (!opponent) return null
  const knockerDeadwood = parseNonNegative(uiState.draftDeadwood[knockerId])
  const opponentDeadwood = parseNonNegative(uiState.draftDeadwood[opponent.id])
  if (knockerDeadwood === null || opponentDeadwood === null) return null

  const scores = {
    [knockerId]: 0,
    [opponent.id]: 0,
  }

  const isGin = knockerDeadwood === 0
  const isBigGin = isGin && uiState.draftBigGin
  let summary = ""

  if (isGin) {
    const bonus = isBigGin ? 31 : 25
    scores[knockerId] = opponentDeadwood + bonus
    summary = isBigGin ? "Big Gin" : "Gin"
  } else if (opponentDeadwood <= knockerDeadwood) {
    scores[opponent.id] = knockerDeadwood - opponentDeadwood + 25
    summary = "Undercut"
  } else {
    scores[knockerId] = opponentDeadwood - knockerDeadwood
    summary = "Knock"
  }

  return {
    scores,
    summary,
    knockerId,
    knockerDeadwood,
    opponentDeadwood,
    isGin,
    isBigGin,
  }
}

const totalsFor = (rounds, players) => {
  const totals = {}
  players.forEach((player) => {
    totals[player.id] = 0
  })
  rounds.forEach((round) => {
    players.forEach((player) => {
      const value = round.scores[player.id]
      totals[player.id] += Number.isFinite(value) ? value : 0
    })
  })
  return totals
}

const GinRummyApp = {
  oninit: () => {
    resetDraft(state.players)
    saveState(state)
  },
  view: () => {
    const totals = totalsFor(state.rounds, state.players)
    const canScore = state.players.length === 2
    if (uiState.draftKnockerId === null && state.players.length > 0) {
      uiState.draftKnockerId = state.players[0].id
    }
    ensureDraftDeadwood(state.players)
    const draftOutcome = buildRoundOutcome(state.players)

    const addRound = (event) => {
      event.preventDefault()
      if (!canScore) return
      if (!draftOutcome) return
      state.rounds.push({
        id: state.nextRoundId++,
        scores: draftOutcome.scores,
        meta: {
          knockerId: draftOutcome.knockerId,
          knockerDeadwood: draftOutcome.knockerDeadwood,
          opponentDeadwood: draftOutcome.opponentDeadwood,
          isGin: draftOutcome.isGin,
          isBigGin: draftOutcome.isBigGin,
          summary: draftOutcome.summary,
        },
      })
      resetDraft(state.players)
      saveState(state)
    }

    return m("div.stack", [
      m("div.page-header", [
        m("a.back-link", { href: "../index.html" }, "Back to main page"),
        m("h1", "Gin Rummy Scoresheet"),
        m(
          "p",
          "Track scores for each round. All data stays in this browser."
        ),
      ]),
      m("section.card", [
        m("h2", "Players"),
        state.players.map((player) =>
          m("div.player-row", { key: player.id }, [
            m("input.text-input", {
              value: player.name,
              oninput: (event) => {
                player.name = event.target.value
                saveState(state)
              },
              "aria-label": "Player name",
            }),
          ])
        ),
        !canScore
          ? m(
              "p",
              "Gin Rummy scoring is currently set up for exactly two players."
            )
          : null,
      ]),
      m("section.card", [
        m("div.section-header", [
          m("h2", "Scoreboard"),
          m(
            "button.secondary-button",
            {
              type: "button",
              onclick: () => {
                state.rounds = []
                state.nextRoundId = 1
                saveState(state)
              },
            },
            "Clear rounds"
          ),
        ]),
        !canScore
          ? m(
              "p",
              "Gin Rummy scoring is currently set up for two players."
            )
          : null,
        m(
          "form.round-form",
          {
            onsubmit: addRound,
          },
          m("div.table-wrap", [
            m("table.score-table", [
              m("thead", [
                m("tr", [
                  m("th", "Round"),
                  ...state.players.map((player) => m("th", player.name)),
                ]),
              ]),
              m("tbody", [
                ...state.rounds.map((round) =>
                  m("tr", { key: round.id }, [
                    m("td", [
                      m("div", `#${round.id}`),
                      round.meta
                        ? m(
                            "div.muted-text",
                            `${round.meta.summary} (Knocker ${
                              state.players.find(
                                (player) => player.id === round.meta.knockerId
                              )?.name || "?"
                            }, DW ${round.meta.knockerDeadwood})`
                          )
                        : null,
                    ]),
                    ...state.players.map((player) =>
                      m("td", round.scores[player.id] ?? 0)
                    ),
                  ])
                ),
                m("tr", { key: "input-row" }, [
                  m("td", [
                    m("div", "Next"),
                    m("div.field-label", "Knocker"),
                    m("div.radio-group", [
                      ...state.players.map((player) =>
                        m("label.knocker-choice", [
                          m("input", {
                            type: "radio",
                            name: "knocker",
                            value: player.id,
                            checked: uiState.draftKnockerId === player.id,
                            disabled: !canScore,
                            onchange: () => {
                              uiState.draftKnockerId = player.id
                            },
                          }),
                          player.name,
                        ])
                      ),
                      m("label.checkbox-field", [
                        m("input", {
                          type: "checkbox",
                          checked: uiState.draftBigGin,
                          disabled:
                            !canScore ||
                            parseNonNegative(
                              uiState.draftDeadwood[uiState.draftKnockerId]
                            ) !== 0,
                          onchange: (event) => {
                            uiState.draftBigGin = event.target.checked
                          },
                        }),
                        "Big Gin",
                      ]),
                    ]),
                    m(
                      "button.primary-button",
                      { type: "submit", disabled: !draftOutcome },
                      "Add round"
                    ),
                    draftOutcome
                      ? m(
                          "div.muted-text",
                          `${draftOutcome.summary} score ready`
                        )
                      : m("div.muted-text", "Enter deadwood to score"),
                  ]),
                  ...state.players.map((player) =>
                    m("td", [
                      m("div.field-label", "Deadwood"),
                      m("input.score-input", {
                        type: "number",
                        min: 0,
                        step: 1,
                        inputmode: "numeric",
                        value: uiState.draftDeadwood[player.id],
                        disabled: !canScore,
                        oninput: (event) => {
                          uiState.draftDeadwood[player.id] = event.target.value
                        },
                        placeholder: "0",
                      }),
                    ])
                  ),
                ]),
              ]),
              m("tfoot", [
                m("tr", [
                  m("td", "Total"),
                  ...state.players.map((player) => m("td", totals[player.id])),
                ]),
              ]),
            ]),
          ])
        ),
      ]),
    ])
  },
}

m.mount(document.getElementById("app"), GinRummyApp)
