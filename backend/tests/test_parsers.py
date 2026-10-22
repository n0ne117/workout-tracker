"""File parsers read what the formats carry."""
from app.services.tcx_parser import parse_tcx

TCX = b"""<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity Sport="Running"><Id>2026-07-01T05:00:00Z</Id><Lap StartTime="2026-07-01T05:00:00Z">
<TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>2000</DistanceMeters>
<AverageHeartRateBpm><Value>140</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>165</Value></MaximumHeartRateBpm>
<Track>
<Trackpoint><Time>2026-07-01T05:00:00Z</Time><Position><LatitudeDegrees>48.2</LatitudeDegrees><LongitudeDegrees>16.3</LongitudeDegrees></Position>
<HeartRateBpm><Value>138</Value></HeartRateBpm><Cadence>84</Cadence></Trackpoint>
<Trackpoint><Time>2026-07-01T05:00:05Z</Time><Position><LatitudeDegrees>48.2001</LatitudeDegrees><LongitudeDegrees>16.3001</LongitudeDegrees></Position>
<HeartRateBpm><Value>142</Value></HeartRateBpm><Cadence>86</Cadence></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>"""


def test_tcx_reads_heart_rate_and_cadence():
    data = parse_tcx(TCX)
    assert data["avg_heart_rate"] == 140
    assert data["max_heart_rate"] == 165
    assert [p["hr"] for p in data["track_points"]] == [138, 142]
    assert [p["cad"] for p in data["track_points"]] == [84, 86]
