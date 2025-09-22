there are several web APIs available to retrieve a Digital Object Identifier (DOI) from article information such as the title, author, and journal. One of the most prominent and widely used is the CrossRef API.

CrossRef API
The CrossRef API is a free service that allows you to search for metadata of scholarly articles, including their DOIs. You can query their extensive database using various pieces of information you have about a publication.


How to Use It
You can make requests to the CrossRef API by constructing a URL with the article's information as query parameters. The base URL for the API is https://api.crossref.org/works.

Here are some common parameters you can use to search for an article:

query.bibliographic: This is a versatile parameter where you can input a combination of the title, author's last name, and other bibliographic information.

query.title: Use this to search specifically by the article's title.

query.author: Use this to search by the author's name.

Example Query:

Let's say you are looking for the DOI of an article with the title "The structure of the DNA" by "Crick". You can construct a URL like this:

https://api.crossref.org/works?query.bibliographic=The+structure+of+the+DNA+Crick
What the Response Looks Like:

The API will return a JSON object containing a list of matching articles. You will then need to parse this JSON to find the DOI field for the correct entry.

A simplified example of the JSON response might look like this:

JSON

{
  "status": "ok",
  "message-type": "work-list",
  "message": {
    "items": [
      {
        "DOI": "10.1038/171737a0",
        "title": [
          "MOLECULAR STRUCTURE OF NUCLEIC ACIDS"
        ],
        "author": [
          {
            "given": "J. D.",
            "family": "WATSON"
          },
          {
            "given": "F. H. C.",
            "family": "CRICK"
          }
        ]
      }
    ]
  }
}
From this response, you can extract the DOI: 10.1038/171737a0.

Other APIs and Tools
While the CrossRef API is a primary resource, other services and libraries can also help you find DOIs:

mendeley-api: The Mendeley API provides access to a large database of academic papers, and you can often retrieve DOI information through it.

Python Libraries: There are Python libraries, such as habanero, which provide a convenient wrapper for interacting with the CrossRef API and other scholarly APIs.

For most use cases, the CrossRef API is the most direct and comprehensive tool for programmatically finding a DOI from an article's metadata.