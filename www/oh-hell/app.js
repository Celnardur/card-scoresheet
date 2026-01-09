/* global m */

const STORAGE_KEY = "card_scoresheet_oh_hell"

const defaultState = () => ({
  players: [
    { id: 1, name: "Player 1" },
    { id: 2, name: "Player 2" },
    { id: 3, name: "Player 3" },
  ],
  rounds: [],
  firstDealerId: 1,
  nextPlayerId: 4,
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
      firstDealerId:
        typeof parsed.firstDealerId === "number"
          ? parsed.firstDealerId
          : parsed.players.length > 0
            ? parsed.players[0].id
            : null,
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
  phase: "bids",
  draftBids: {},
  draftTricks: {},
  pendingBids: null,
  pendingCardsDealt: null,
}

const ensureDrafts = (players) => {
  players.forEach((player) => {
    if (!(player.id in uiState.draftBids)) {
      uiState.draftBids[player.id] = ""
    }
    if (!(player.id in uiState.draftTricks)) {
      uiState.draftTricks[player.id] = ""
    }
  })
}

const resetDrafts = (players) => {
  uiState.phase = "bids"
  uiState.draftBids = {}
  uiState.draftTricks = {}
  uiState.pendingBids = null
  uiState.pendingCardsDealt = null
  ensureDrafts(players)
}

const parseNonNegative = (value) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Math.max(0, Math.floor(numberValue))
}

const scoreFor = (bid, tricks) => {
  if (bid === tricks) return 10
  return tricks
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

const dealerForRound = (players, firstDealerId, roundIndex) => {
  if (!players.length || !firstDealerId) return null
  const firstIndex = players.findIndex((player) => player.id === firstDealerId)
  if (firstIndex === -1) return null
  const dealerIndex = (firstIndex + roundIndex) % players.length
  return players[dealerIndex]
}

const cardsDealtForRound = (roundIndex) => {
  if (roundIndex < 0) return null
  if (roundIndex < 10) return 10 - roundIndex
  if (roundIndex < 19) return roundIndex - 8
  return null
}

const OhHellApp = {
  oninit: () => {
    if (!state.firstDealerId && state.players.length > 0) {
      state.firstDealerId = state.players[0].id
    }
    saveState(state)
  },
  view: () => {
    ensureDrafts(state.players)
    const totals = totalsFor(state.rounds, state.players)
    if (!state.firstDealerId && state.players.length > 0) {
      state.firstDealerId = state.players[0].id
    }
    const nextCardsDealt = cardsDealtForRound(state.rounds.length)
    const nextDealer = dealerForRound(
      state.players,
      state.firstDealerId,
      state.rounds.length
    )

    const lockBids = (event) => {
      event.preventDefault()
      if (nextCardsDealt === null) return
      const bids = {}
      let hasBid = false
      for (const player of state.players) {
        const parsed = parseNonNegative(uiState.draftBids[player.id])
        if (parsed === null) return
        if (uiState.draftBids[player.id] !== "") hasBid = true
        bids[player.id] = parsed
      }
      if (!hasBid) return
      uiState.pendingBids = bids
      uiState.pendingCardsDealt = nextCardsDealt
      uiState.phase = "tricks"
      uiState.draftTricks = {}
      ensureDrafts(state.players)
    }

    const scoreRound = (event) => {
      event.preventDefault()
      if (!uiState.pendingBids) return
      const tricks = {}
      let hasTrick = false
      for (const player of state.players) {
        const parsed = parseNonNegative(uiState.draftTricks[player.id])
        if (parsed === null) return
        if (uiState.draftTricks[player.id] !== "") hasTrick = true
        tricks[player.id] = parsed
      }
      if (!hasTrick) return
      const scores = {}
      state.players.forEach((player) => {
        scores[player.id] = scoreFor(uiState.pendingBids[player.id], tricks[player.id])
      })
      const roundIndex = state.rounds.length
      const dealer = dealerForRound(
        state.players,
        state.firstDealerId,
        roundIndex
      )
      state.rounds.push({
        id: state.nextRoundId++,
        scores,
        meta: {
          bids: uiState.pendingBids,
          tricks,
          cardsDealt: uiState.pendingCardsDealt,
          dealerId: dealer ? dealer.id : null,
        },
      })
      resetDrafts(state.players)
      saveState(state)
    }

    const canSubmitBids =
      nextCardsDealt !== null &&
      state.players.length > 0 &&
      state.players.every((player) =>
        uiState.draftBids[player.id] !== ""
      )
    const totalBidsEntered = state.players.reduce((sum, player) => {
      const parsed = parseNonNegative(uiState.draftBids[player.id])
      return parsed === null ? sum : sum + parsed
    }, 0)
    const totalTricksEntered = state.players.reduce((sum, player) => {
      const parsed = parseNonNegative(uiState.draftTricks[player.id])
      return parsed === null ? sum : sum + parsed
    }, 0)
    const tricksMatchCards =
      uiState.pendingCardsDealt !== null &&
      totalTricksEntered === uiState.pendingCardsDealt
    const canSubmitTricks =
      uiState.pendingBids &&
      state.players.length > 0 &&
      state.players.every((player) =>
        uiState.draftTricks[player.id] !== ""
      ) &&
      tricksMatchCards

    return m("div.stack", [
      m("div.page-header", [
        m("a.back-link", { href: "../index.html" }, "Back to main page"),
        m("h1", "Oh Hell Scoresheet"),
        m(
          "p",
          "Enter bids, then tricks taken. Exact bids score 10 + tricks; misses score the negative difference."
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
            m("label.knocker-choice", [
              m("input", {
                type: "radio",
                name: "first-dealer",
                value: player.id,
                checked: state.firstDealerId === player.id,
                onchange: () => {
                  state.firstDealerId = player.id
                  saveState(state)
                },
              }),
              "First dealer",
            ]),
            state.players.length > 2
              ? m(
                  "button.secondary-button",
                  {
                    type: "button",
                    onclick: () => {
                      state.players = state.players.filter(
                        (item) => item.id !== player.id
                      )
                      state.rounds = state.rounds.map((round) => {
                        const nextScores = { ...round.scores }
                        delete nextScores[player.id]
                        return { ...round, scores: nextScores }
                      })
                      delete uiState.draftBids[player.id]
                      delete uiState.draftTricks[player.id]
                      if (uiState.pendingBids) {
                        const nextBids = { ...uiState.pendingBids }
                        delete nextBids[player.id]
                        uiState.pendingBids = nextBids
                      }
                      if (state.firstDealerId === player.id) {
                        state.firstDealerId =
                          state.players.length > 0 ? state.players[0].id : null
                      }
                      if (uiState.phase === "tricks") {
                        resetDrafts(state.players)
                      }
                      saveState(state)
                    },
                  },
                  "Remove"
                )
              : null,
          ])
        ),
        m(
          "button.secondary-button",
          {
            type: "button",
            onclick: () => {
              state.players.push({
                id: state.nextPlayerId++,
                name: `Player ${state.nextPlayerId - 1}`,
              })
              if (!state.firstDealerId) {
                state.firstDealerId = state.players[0].id
              }
              resetDrafts(state.players)
              saveState(state)
            },
          },
          "Add player"
        ),
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
                resetDrafts(state.players)
                saveState(state)
              },
            },
            "Clear rounds"
          ),
        ]),
        m(
          "form.round-form",
          {
            onsubmit: uiState.phase === "bids" ? lockBids : scoreRound,
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
                      m("div", `Cards: ${round.meta?.cardsDealt ?? 0}`),
                      m(
                        "div.muted-text",
                        `Dealer: ${
                          state.players.find(
                            (player) => player.id === round.meta?.dealerId
                          )?.name || "?"
                        }`
                      ),
                    ]),
                    ...state.players.map((player) =>
                      m("td", [
                        m("span", round.scores[player.id] ?? 0),
                        round.meta
                          ? m(
                              "span.inline-muted",
                              `(bid ${round.meta.bids[player.id] ?? 0})`
                            )
                          : null,
                      ])
                    ),
                  ])
                ),
                ...(uiState.phase === "tricks" && uiState.pendingBids
                  ? [
                      m("tr", { key: "pending-bids" }, [
                        m("td", [
                          m("div", "Bids"),
                          m("div.muted-text", "Locked"),
                        ]),
                        ...state.players.map((player) =>
                          m("td", uiState.pendingBids[player.id])
                        ),
                      ]),
                    ]
                  : []),
                uiState.phase === "bids"
                  ? m("tr", { key: "input-bids" }, [
                      m("td", [
                        m("div", "Bids"),
                        nextCardsDealt !== null
                          ? m(
                              "div.muted-text",
                              `Cards: ${nextCardsDealt}`
                            )
                          : m(
                              "div.muted-text",
                              "Series complete"
                            ),
                        nextDealer
                          ? m("div.muted-text", `Dealer: ${nextDealer.name}`)
                          : null,
                        m(
                          "div.muted-text",
                          `Total bids: ${totalBidsEntered}`
                        ),
                        m(
                          "button.primary-button",
                          { type: "submit", disabled: !canSubmitBids },
                          "Lock bids"
                        ),
                      ]),
                      ...state.players.map((player) =>
                        m("td", [
                          m("div.field-label", player.name),
                          m("input.score-input", {
                            type: "number",
                            min: 0,
                            step: 1,
                            inputmode: "numeric",
                            value: uiState.draftBids[player.id],
                            oninput: (event) => {
                              uiState.draftBids[player.id] = event.target.value
                            },
                            placeholder: "0",
                          }),
                        ])
                      ),
                    ])
                  : m("tr", { key: "input-tricks" }, [
                      m("td", [
                        m("div", "Tricks"),
                        m(
                          "button.primary-button",
                          { type: "submit", disabled: !canSubmitTricks },
                          "Score round"
                        ),
                        uiState.pendingCardsDealt !== null
                          ? m(
                              "div.muted-text",
                              `Total tricks: ${totalTricksEntered}/${uiState.pendingCardsDealt}`
                            )
                          : null,
                        uiState.pendingCardsDealt !== null && !tricksMatchCards
                          ? m(
                              "div.error-text",
                              "Tricks must add up to cards dealt."
                            )
                          : null,
                      ]),
                      ...state.players.map((player) =>
                        m("td", [
                          m("div.field-label", player.name),
                          m("input.score-input", {
                            type: "number",
                            min: 0,
                            step: 1,
                            inputmode: "numeric",
                            value: uiState.draftTricks[player.id],
                            oninput: (event) => {
                              uiState.draftTricks[player.id] = event.target.value
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
                  ...state.players.map((player) =>
                    m("td", [
                      m("div.field-label", player.name),
                      m("div", totals[player.id]),
                    ])
                  ),
                ]),
              ]),
            ]),
          ])
        ),
      ]),
    ])
  },
}

m.mount(document.getElementById("app"), OhHellApp)
