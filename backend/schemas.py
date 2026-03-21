from pydantic import BaseModel
from typing import Literal


class Airport(BaseModel):
    code: str                     # IATA: "YYZ"
    name: str
    city: str
    mct_domestic_min: int         # Minimum Connect Time domestic→domestic (minutes)
    mct_international_min: int    # Minimum Connect Time intl→intl or domestic→intl
    hotel_cost_usd: float         # Cost per stranded passenger per night
    disrupted: bool = False       # True when weather event is active


class AircraftCost(BaseModel):
    aircraft_type: str            # "B737", "B777", "A320", "Dash8"
    cost_per_min_usd: float       # Operational cost per minute of delay
    min_turn_time_min: int        # Minimum ground time before next departure


class InboundFlight(BaseModel):
    flight_id: str                # "AC101"
    origin: str                   # IATA origin
    destination: str              # Always the hub (YYZ in the scenario)
    aircraft_type: str
    sta_min: int                  # Scheduled Time of Arrival (minutes from sim start)
    eta_min: int                  # Estimated Time of Arrival (with delay)
    delay_min: int                # eta_min - sta_min
    capacity: int                 # Total seats
    total_pax: int                # Total passengers on board


class OutboundFlight(BaseModel):
    flight_id: str                # "AC301"
    origin: str                   # Always the hub (YYZ)
    destination: str              # IATA destination
    aircraft_type: str
    std_min: int                  # Scheduled Time of Departure (minutes from sim start)
    etd_min: int                  # Will be updated by optimizer
    max_delay_min: int            # Hard limit: curfew or crew duty time
    capacity: int
    total_pax_onboard: int        # Local pax already boarded (not connecting)


class PaxGroup(BaseModel):
    group_id: str
    inbound_flight_id: str
    outbound_flight_id: str
    count: int
    tier: Literal["business", "economy"]  # business penalty is 3x economy


class GlobalCosts(BaseModel):
    economy_stranded_cost_usd: float    # Cost per stranded economy passenger
    business_stranded_cost_usd: float   # Cost per stranded business passenger
    cancellation_penalty_usd: float     # Fixed penalty per cancelled flight
    soft_constraint_penalty_usd: float  # Penalty for violating hard limits (curfew, crew)


class Scenario(BaseModel):
    scenario_id: str
    name: str
    description: str
    hub: str                            # "YYZ"
    sim_start_clock: str                # "08:00" — human-readable reference
    airports: list[Airport]
    aircraft_costs: list[AircraftCost]
    inbound_flights: list[InboundFlight]
    outbound_flights: list[OutboundFlight]
    pax_groups: list[PaxGroup]
    global_costs: GlobalCosts


# --- Optimizer I/O ---

class OptimizeRequest(BaseModel):
    scenario_id: str = "yyz_snowstorm"


class FlightDecision(BaseModel):
    flight_id: str
    delay_applied_min: int
    cancelled: bool
    etd_final_min: int
    etd_final_clock: str            # Human-readable, e.g. "14:35"
    cost_delay_usd: float


class PaxGroupResult(BaseModel):
    group_id: str
    inbound_flight_id: str
    outbound_flight_id: str
    count: int
    tier: str
    connection_made: bool
    cost_stranded_usd: float


class OptimizeResult(BaseModel):
    scenario_id: str
    baseline_cost_usd: float
    optimized_cost_usd: float
    savings_usd: float
    passengers_protected: int
    passengers_stranded: int
    total_delay_minutes: int
    flight_decisions: list[FlightDecision]
    pax_results: list[PaxGroupResult]


# --- Chat ---

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    scenario: Scenario | None = None
    optimize_result: OptimizeResult | None = None


class ChatResponse(BaseModel):
    reply: str
